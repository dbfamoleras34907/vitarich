"use client";

import React, { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ChickGradingProcess,
  createChickGradingProcess,
  getChickGradingProcessById,
  listEggReferences,
  updateChickGradingProcess,
  generateNextBatchCode,
  getChicksHatchedByEggRef,
} from "./api";

import Breadcrumb from "@/lib/Breadcrumb";
import FormActionButtons from "@/components/FormActionButtons";
import { db } from "@/lib/Supabase/supabaseClient";
import { getProfileByAuthId } from "@/app/admin/user/api";
import type { User } from "@supabase/supabase-js";
import type { UserRow } from "@/lib/types";

// non-negative number helper (handles NaN, null, undefined)
function n(v: any) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, x);
}

// used for inputs: "return to 0" if invalid/negative
function clampNonNegative(value: string) {
  const x = Number(value);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, x);
}

function fmtDT(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function Chickgradingform() {
  const router = useRouter();
  const sp = useSearchParams();
  const idParam = sp.get("id");

  const editId = useMemo(() => (idParam ? Number(idParam) : null), [idParam]);
  const isEdit = !!editId;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [eggRefs, setEggRefs] = useState<string[]>([]);
  const [eggRefsLoading, setEggRefsLoading] = useState(false);

  const [batchLoading, setBatchLoading] = useState(false);
  const [totalLoading, setTotalLoading] = useState(false);

  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserRow | null>(null);

  // include class_c
  const [form, setForm] = useState<
    Partial<ChickGradingProcess> & { class_c?: any }
  >({
    egg_ref_no: "",
    batch_code: "",
    grading_datetime: new Date().toISOString(),
    grading_personnel: "",

    class_a: 0,
    class_b: 0,
    class_a_junior: 0,
    class_c: 0,

    cull_chicks: 0,
    dead_chicks: 0,
    infertile: 0,
    dead_germ: 0,
    live_pip: 0,
    dead_pip: 0,
    unhatched: 0,
    rotten: 0,

    chick_room_temperature: null,

    total_chicks: null,
    good_quality_chicks: null,
    quality_grade_rate: null,
    cull_rate: null,
  });

  function setField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  // ✅ Get current user session and profile
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const {
          data: { session },
        } = await db.auth.getSession();
        if (!alive) return;

        if (session?.user) {
          setLoggedInUser(session.user);

          // Get user profile from database
          const profile = await getProfileByAuthId(session.user.id);
          if (!alive) return;

          if (profile) {
            setUserProfile(profile);

            // Auto-fill grading_personnel with full name if not in edit mode
            if (!editId) {
              const fullName =
                `${profile.firstname || ""} ${profile.middlename || ""} ${profile.lastname || ""}`.trim();
              if (fullName) {
                setForm((prev) => ({
                  ...prev,
                  grading_personnel: fullName,
                }));
              }
            }
          }
        }
      } catch (e) {
        console.error("Failed to get user session/profile:", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editId]);

  function onNumChange(key: keyof typeof form) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const v = clampNonNegative(e.target.value);
      setForm((p) => ({ ...p, [key]: v as any }));
    };
  }

  function onNumBlur(key: keyof typeof form) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const v = clampNonNegative(e.target.value);
      e.currentTarget.value = String(v);
      setForm((p) => ({ ...p, [key]: v as any }));
    };
  }

  // ✅ load dropdown
  useEffect(() => {
    let alive = true;
    (async () => {
      setEggRefsLoading(true);
      try {
        const refs = await listEggReferences();
        if (!alive) return;
        setEggRefs(refs);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setEggRefs([]);
      } finally {
        if (alive) setEggRefsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ✅ load edit record
  useEffect(() => {
    if (!editId) return;
    setLoading(true);
    (async () => {
      try {
        const rec = await getChickGradingProcessById(editId);

        setForm({
          ...rec,
          egg_ref_no: rec.egg_ref_no ?? "",
          batch_code: rec.batch_code ?? "",
          grading_personnel: rec.grading_personnel ?? "",
          grading_datetime: rec.grading_datetime ?? new Date().toISOString(),

          class_a: n(rec.class_a),
          class_b: n(rec.class_b),
          class_a_junior: n(rec.class_a_junior),
          class_c: n((rec as any).class_c),

          cull_chicks: n(rec.cull_chicks),
          dead_chicks: n(rec.dead_chicks),
          infertile: n(rec.infertile),
          dead_germ: n(rec.dead_germ),
          live_pip: n(rec.live_pip),
          dead_pip: n(rec.dead_pip),
          unhatched: n(rec.unhatched),
          rotten: n(rec.rotten),

          total_chicks: rec.total_chicks ?? null,
          good_quality_chicks: rec.good_quality_chicks ?? null,
          quality_grade_rate: rec.quality_grade_rate ?? null,
          cull_rate: rec.cull_rate ?? null,

          chick_room_temperature:
            rec.chick_room_temperature === undefined
              ? null
              : (rec.chick_room_temperature ?? null),
        });
      } catch (e: any) {
        alert(e?.message ?? "Failed to load record.");
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  // ✅ Auto-generate Batch Code when Egg Ref changes (NEW only)
  useEffect(() => {
    const egg = (form.egg_ref_no ?? "").trim();

    if (!egg) {
      setForm((p) => ({
        ...p,
        batch_code: isEdit ? p.batch_code : "",
        total_chicks: null, // clear total chicks when egg cleared
      }));
      return;
    }

    let alive = true;

    (async () => {
      try {
        setTotalLoading(true);

        // ✅ 1) Total chicks from chick_pullout_process
        const chicks = await getChicksHatchedByEggRef(egg);
        if (!alive) return;

        setForm((p) => ({
          ...p,
          total_chicks: chicks, // ✅ Total chicks field will "play"
        }));

        // ✅ 2) Auto batch code (NEW only, do not overwrite edit)
        if (!isEdit) {
          setBatchLoading(true);
          const code = await generateNextBatchCode(egg, new Date());
          if (!alive) return;
          setForm((p) => ({ ...p, batch_code: code }));
        }
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        alert(e?.message ?? "Failed to load total chicks / batch code.");
        setForm((p) => ({
          ...p,
          total_chicks: null,
          ...(isEdit ? {} : { batch_code: "" }),
        }));
      } finally {
        if (alive) {
          setTotalLoading(false);
          setBatchLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [form.egg_ref_no, isEdit]);

  // ✅ Total of By Product and for Dispose
  const totalByProductPreview = useMemo(() => {
    return (
      n(form.infertile) +
      n(form.dead_germ) +
      n(form.dead_chicks) +
      n(form.live_pip) +
      n(form.dead_pip) +
      n(form.unhatched) +
      n(form.rotten) +
      n(form.cull_chicks)
    );
  }, [
    form.infertile,
    form.dead_germ,
    form.dead_chicks,
    form.live_pip,
    form.dead_pip,
    form.unhatched,
    form.rotten,
    form.cull_chicks,
  ]);

  const totalFromInputsPreview = useMemo(() => {
    return (
      n(form.class_a) +
      n(form.class_b) +
      n(form.class_a_junior) +
      n((form as any).class_c) +
      n(form.cull_chicks) +
      n(form.dead_chicks) +
      n(form.infertile) +
      n(form.dead_germ) +
      n(form.live_pip) +
      n(form.dead_pip) +
      n(form.unhatched) +
      n(form.rotten)
    );
  }, [
    form.class_a,
    form.class_b,
    form.class_a_junior,
    (form as any).class_c,
    form.cull_chicks,
    form.dead_chicks,
    form.infertile,
    form.dead_germ,
    form.live_pip,
    form.dead_pip,
    form.unhatched,
    form.rotten,
  ]);

  // ---- PREVIEWS (UI computed) ----
  const totalChicksPreview = useMemo(() => {
    return n(form.total_chicks);
  }, [form.total_chicks]);

  const goodQualityPreview = useMemo(() => {
    return (
      n(form.class_a) +
      n(form.class_b) +
      n(form.class_a_junior) +
      n((form as any).class_c)
    );
  }, [form.class_a, form.class_b, form.class_a_junior, (form as any).class_c]);

  const qualityRatePreview = useMemo(() => {
    const t = totalChicksPreview;
    if (t <= 0) return "";
    return ((goodQualityPreview / t) * 100).toFixed(2);
  }, [totalChicksPreview, goodQualityPreview]);

  const cullRatePreview = useMemo(() => {
    const t = totalChicksPreview;
    if (t <= 0) return "";
    return ((n(form.cull_chicks) / t) * 100).toFixed(2);
  }, [totalChicksPreview, form.cull_chicks]);

  function eqInt(a: number, b: number) {
    return Math.round(a) === Math.round(b);
  }

  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "";
    return Number(value).toLocaleString("en-PH");
  };

  const handleFormattedNumberChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof typeof form,
  ) => {
    // remove commas
    const raw = e.target.value.replace(/,/g, "");

    // allow only digits
    if (!/^\d*$/.test(raw)) return;

    setForm((prev) => ({
      ...prev,
      [field]: raw === "" ? 0 : Number(raw),
    }));
  };

  async function onSave() {
    if (!(form.egg_ref_no ?? "").trim()) {
      alert("Egg Reference No. is required.");
      return;
    }
    if (!(form.batch_code ?? "").trim()) {
      alert("Batch code is required.");
      return;
    }
    const totalChicks = n(form.total_chicks); // from pullout (chicks_hatched)
    const totalInputs = totalFromInputsPreview;

    if (totalChicks <= 0) {
      alert(
        "Total chicks is empty or 0. Please select a valid Egg Reference No.",
      );
      return;
    }

    if (Math.round(totalInputs) !== Math.round(totalChicks)) {
      alert(
        `Cannot save.\n\nTotal of Class A to Rotten = ${totalInputs}\nTotal Chicks = ${totalChicks}\n\nPlease make them equal before saving.`,
      );
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        egg_ref_no: form.egg_ref_no?.trim() || null,
        batch_code: (form.batch_code ?? "").trim(),
        grading_datetime: form.grading_datetime ?? new Date().toISOString(),
        grading_personnel: form.grading_personnel?.trim() || null,

        class_a: n(form.class_a),
        class_b: n(form.class_b),
        class_a_junior: n(form.class_a_junior),
        class_c: n((form as any).class_c),

        cull_chicks: n(form.cull_chicks),
        dead_chicks: n(form.dead_chicks),
        infertile: n(form.infertile),
        dead_germ: n(form.dead_germ),
        live_pip: n(form.live_pip),
        dead_pip: n(form.dead_pip),
        unhatched: n(form.unhatched),
        rotten: n(form.rotten),

        chick_room_temperature:
          form.chick_room_temperature === null ||
          form.chick_room_temperature === undefined
            ? null
            : Number(form.chick_room_temperature),
      };

      if (isEdit && editId) {
        await updateChickGradingProcess(editId, payload);
        alert("Updated successfully.");
      } else {
        await createChickGradingProcess(payload);
        alert("Saved successfully.");
      }

      router.push("/jmb/docclassification");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const disabledAll = saving || loading;

  return (
    <div className="w-full  px-6 py-6  mt-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="DOC Classification"
        CurrentPageName={isEdit ? "Edit Entry" : "New DOC Classification"}
      />

      <Card className="w-full  min-h-[calc(90vh-120px)] p-6 space-y-4 mt-2">
        <CardContent className="max-w-2xl p-4 space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-4">
              {/* Top row */}
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Egg Reference No.</Label>
                    <Select
                      value={form.egg_ref_no ?? ""}
                      onValueChange={(v) => setField("egg_ref_no", v)}
                      disabled={eggRefsLoading || saving}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            eggRefsLoading
                              ? "Loading..."
                              : "Select Egg Ref. No."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {eggRefs.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Batch Code</Label>
                    <Input
                      value={
                        batchLoading ? "Generating..." : (form.batch_code ?? "")
                      }
                      onChange={(e) => setField("batch_code", e.target.value)}
                      disabled
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Grading Date & Time</Label>
                    <Input value={fmtDT(form.grading_datetime)} disabled />
                  </div>

                  <div className="space-y-1">
                    <Label>Total Chicks</Label>
                    <Input
                      value={
                        totalLoading ? "Loading..." : String(totalChicksPreview)
                      }
                      disabled
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Grading Personnel</Label>
                    <Input
                      value={form.grading_personnel ?? ""}
                      onChange={(e) =>
                        setField("grading_personnel", e.target.value)
                      }
                      disabled
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Middle grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Left column */}
                <div className="space-y-4">
                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <Label>Quality: Class A</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.class_a)}
                        onChange={(e) =>
                          handleFormattedNumberChange(e, "class_a")
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Quality: Class A Junior</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.class_a_junior)}
                        onChange={(e) =>
                          handleFormattedNumberChange(e, "class_a_junior")
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <Label>Infertile</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.infertile)}
                        onChange={(e) =>
                          handleFormattedNumberChange(e, "infertile")
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Live Pip</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.live_pip)}
                        onChange={(e) =>
                          handleFormattedNumberChange(e, "live_pip")
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <Label>Cull Chicks</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.cull_chicks)}
                        onChange={(e) =>
                          handleFormattedNumberChange(e, "cull_chicks")
                        }
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Unhatched</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.unhatched)}
                        onChange={(e) =>
                          handleFormattedNumberChange(e, "unhatched")
                        }
                        onBlur={onNumBlur("unhatched")}
                      />
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-4">
                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <Label>Quality: Class B</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.class_b)}
                        onChange={(e) =>
                          handleFormattedNumberChange(e, "class_b")
                        }
                        onBlur={onNumBlur("class_b")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Quality: Class C</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.class_c)}
                        onChange={(e) =>
                          handleFormattedNumberChange(e, "class_c")
                        }
                        onBlur={onNumBlur("class_c")}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <Label>Dead Chicks</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.dead_chicks)}
                        onChange={(e) =>
                          handleFormattedNumberChange(e, "dead_chicks")
                        }
                        onBlur={onNumBlur("dead_chicks")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Dead Germ</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.dead_germ)}
                        onChange={(e) =>
                          handleFormattedNumberChange(e, "dead_germ")
                        }
                        onBlur={onNumBlur("dead_germ")}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <Label>Dead Pip</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.dead_pip)}
                        onChange={(e) =>
                          handleFormattedNumberChange(e, "dead_pip")
                        }
                        onBlur={onNumBlur("dead_pip")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Rotten</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.rotten)}
                        onChange={(e) =>
                          handleFormattedNumberChange(e, "rotten")
                        }
                        onBlur={onNumBlur("rotten")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Bottom section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Good Quality Chicks</Label>
                    <Input
                      value={String(goodQualityPreview)}
                      // value={
                      //   form.good_quality_chicks !== null && form.good_quality_chicks !== undefined
                      //     ? String(form.good_quality_chicks)
                      //     : String(goodQualityPreview)
                      // }
                      disabled
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Total By Product and For Dispose</Label>
                    <Input value={String(totalByProductPreview)} disabled />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Quality Grade Rate %</Label>
                    <Input
                      value={
                        form.quality_grade_rate !== null &&
                        form.quality_grade_rate !== undefined
                          ? String(form.quality_grade_rate)
                          : qualityRatePreview
                      }
                      disabled
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Cull Rate %</Label>
                    <Input
                      value={
                        form.cull_rate !== null && form.cull_rate !== undefined
                          ? String(form.cull_rate)
                          : cullRatePreview
                      }
                      disabled
                    />
                  </div>
                </div>
              </div>

              <FormActionButtons
                saving={saving}
                isEdit={isEdit}
                cancelPath="/jmb/docclassification"
                onSave={onSave}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
