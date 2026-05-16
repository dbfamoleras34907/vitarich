/**
 * Chick Grading Form Component
 *
 * A comprehensive form for recording and managing chick grading data in the hatchery document classification system.
 * Supports both creating new grading records and editing existing ones.
 *
 * @component
 * @returns {JSX.Element} The rendered chick grading form
 *
 * @remarks
 * - Automatically loads the current logged-in user's information and populates the grading personnel field
 * - Fetches available egg references from the database for selection
 * - Generates batch codes automatically when a new egg reference is selected
 * - Retrieves remaining inventory from the egg reference
 * - Validates that the sum of all quality grades equals the total chicks before saving
 * - Calculates quality grade rate and cull rate percentages in real-time
 * - Supports keyboard input with number formatting (comma-separated thousands)
 *
 * @example
 * // Usage in a Next.js app
 * import Chickgradingform from '@/app/jmb/docclassification/newv2/Chickgradingform';
 *
 * export default function Page() {
 *   return <Chickgradingform />;
 * }
 *
 * @example
 * // For editing an existing record, pass the ID via query parameter
 * // Route: /jmb/docclassification/newv2?id=123
 */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import {
  ChickGradingProcess,
  ChickGradingProcessCreate,
  createChickGradingProcess,
  getChickGradingProcessById,
  listEggReferences,
  updateChickGradingProcess,
  generateNextBatchCode,
  getRemainingDocClassificationInventory,
} from "./api";

import Breadcrumb from "@/lib/Breadcrumb";
import FormActionButtons from "@/components/FormActionButtons";
import { db } from "@/lib/Supabase/supabaseClient";
import { getProfileByAuthId } from "@/app/admin/user/api";
import type { User } from "@supabase/supabase-js";
import type { UserRow } from "@/lib/types";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import RequiredLabel from "@/components/RequiredLabel";
import SearchableDropdown from "@/lib/SearchableDropdown";
import { usePermission } from "@/hooks/usePermission";

type EggRefOption = {
  egg_ref_no: string;
};

type FormState = {
  egg_ref_no: string;
  batch_code: string;
  grading_datetime: string;
  grading_personnel: string;

  class_a: number;
  class_b: number;
  class_a_junior: number;
  class_c: number;
  cull_chicks: number;
  dead_chicks: number;
  infertile: number;
  dead_germ: number;
  live_pip: number;
  dead_pip: number;
  unhatched: number;
  rotten: number;
  exploder: number;
  unhatched_good: number;
  unhatched_bad: number;
  infertile_good: number;
  infertile_bad: number;

  chick_room_temperature: number | null;

  total_chicks: number | null;
  good_quality_chicks: number | null;
  quality_grade_rate: number | null;
  cull_rate: number | null;
};

const initialForm: FormState = {
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
  exploder: 0,
  unhatched_good: 0,
  unhatched_bad: 0,
  infertile_good: 0,
  infertile_bad: 0,

  chick_room_temperature: null,

  total_chicks: null,
  good_quality_chicks: null,
  quality_grade_rate: null,
  cull_rate: null,
};

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function fmtDT(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return Number(value).toLocaleString("en-PH");
}

export default function Chickgradingform() {
  // const router = useRouter();
  // const sp = useSearchParams();
  // const idParam = sp.get("id");

  // const editId = useMemo(() => (idParam ? Number(idParam) : null), [idParam]);
  // const isEdit = !!editId;



  
     const router = useRouter();
      const sp = useSearchParams();
    
      const idParam = sp.get("id");
    
      const editId = idParam ? Number(idParam) : null;
    
      const isEdit =
        typeof editId === "number" &&
        Number.isFinite(editId) &&
        editId > 0;
      const canView = usePermission("/jmb/eggsetter/insert");
      const canEdit = usePermission("/jmb/eggsetter/edit");
    
      useEffect(() => {
    
        // wait for permissions
        if (canView === null || canEdit === null) {
          return;
        }
    
        if (isEdit && canEdit) {
          router.replace("/jmb/eggsetter");
          return;
        }
    
        if (!isEdit && canView) {
          router.replace("/jmb/eggsetter");
        }
    
      }, [isEdit, canEdit, canView, router]);
    
  
  

      
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eggRefsLoading, setEggRefsLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [totalLoading, setTotalLoading] = useState(false);

  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserRow | null>(null);

  const [eggRefs, setEggRefs] = useState<EggRefOption[]>([]);
  const [remainingInventory, setRemainingInventory] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleNumberChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/,/g, "");
      if (!/^\d*$/.test(raw)) return;

      setForm((prev) => ({
        ...prev,
        [field]: raw === "" ? 0 : Number(raw),
      }));
    };
  }

  useEffect(() => {
    refreshSessionx(router);
  }, [router]);

  // current user + auto grading personnel
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

          const profile = await getProfileByAuthId(session.user.id);
          if (!alive) return;

          setUserProfile(profile);

          if (!editId && profile) {
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
      } catch (e) {
        console.error("Failed to get session/profile:", e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [editId]);

  // egg ref dropdown
  useEffect(() => {
    let alive = true;

    (async () => {
      setEggRefsLoading(true);
      try {
        const refs = await listEggReferences();
        if (!alive) return;

        setEggRefs(refs.map((egg_ref_no) => ({ egg_ref_no })));
      } catch (e) {
        console.error(e);
        if (alive) setEggRefs([]);
      } finally {
        if (alive) setEggRefsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // load edit record
  useEffect(() => {
    if (!editId) return;

    setLoading(true);

    (async () => {
      try {
        const rec = await getChickGradingProcessById(editId);

        setForm({
          egg_ref_no: rec.egg_ref_no ?? "",
          batch_code: rec.batch_code ?? "",
          grading_datetime: rec.grading_datetime ?? new Date().toISOString(),
          grading_personnel: rec.grading_personnel ?? "",

          class_a: n(rec.class_a),
          class_b: n(rec.class_b),
          class_a_junior: n(rec.class_a_junior),
          class_c: n(rec.class_c),
          cull_chicks: n(rec.cull_chicks),
          dead_chicks: n(rec.dead_chicks),
          infertile: n(rec.infertile),
          dead_germ: n(rec.dead_germ),
          live_pip: n(rec.live_pip),
          dead_pip: n(rec.dead_pip),
          unhatched: n(rec.unhatched),
          rotten: n(rec.rotten),
          exploder: n(rec.exploder),
          unhatched_good: n(rec.unhatched_good),
          unhatched_bad: n(rec.unhatched_bad),
          infertile_good: n(rec.infertile_good),
          infertile_bad: n(rec.infertile_bad),

          chick_room_temperature:
            rec.chick_room_temperature === undefined
              ? null
              : (rec.chick_room_temperature ?? null),

          total_chicks: rec.total_chicks ?? null,
          good_quality_chicks: rec.good_quality_chicks ?? null,
          quality_grade_rate: rec.quality_grade_rate ?? null,
          cull_rate: rec.cull_rate ?? null,
        });
      } catch (e: any) {
        alert(e?.message ?? "Failed to load record.");
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  // remaining inventory + batch code on egg ref change
  useEffect(() => {
    const egg = form.egg_ref_no.trim();

    if (!egg) {
      setRemainingInventory(0);
      setForm((prev) => ({
        ...prev,
        total_chicks: null,
        batch_code: isEdit ? prev.batch_code : "",
      }));
      return;
    }

    let alive = true;

    (async () => {
      try {
        setTotalLoading(true);

        const remaining = await getRemainingDocClassificationInventory(egg);
        if (!alive) return;

        setRemainingInventory(remaining);
        setForm((prev) => ({
          ...prev,
          total_chicks: remaining,
        }));

        if (!isEdit) {
          setBatchLoading(true);
          const code = await generateNextBatchCode(egg, new Date());
          if (!alive) return;

          setForm((prev) => ({
            ...prev,
            batch_code: code,
          }));
        }
      } catch (e: any) {
        console.error(e);

        if (!alive) return;

        alert(e?.message ?? "Failed to load remaining inventory / batch code.");

        setRemainingInventory(0);
        setForm((prev) => ({
          ...prev,
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

  const totalChicksPreview = useMemo(
    () => n(form.total_chicks),
    [form.total_chicks],
  );
  const goodQualityPreview = useMemo(() => n(form.class_a), [form.class_a]);

  const totalByProductPreview = useMemo(() => {
    return (
      n(form.class_a_junior) +
      n(form.class_b) +
      n(form.class_c) +
      n(form.infertile) +
      n(form.dead_germ) +
      n(form.dead_chicks) +
      n(form.unhatched) +
      n(form.live_pip) +
      n(form.dead_pip) +
      n(form.rotten) +
      n(form.cull_chicks) +
      n(form.exploder) +
      n(form.unhatched_good) +
      n(form.unhatched_bad) +
      n(form.infertile_good) +
      n(form.infertile_bad)
    );
  }, [form]);

  const totalFromInputsPreview = useMemo(() => {
    return (
      n(form.class_a) +
      n(form.class_b) +
      n(form.class_a_junior) +
      n(form.class_c) +
      n(form.cull_chicks) +
      n(form.dead_chicks) +
      n(form.infertile) +
      n(form.dead_germ) +
      n(form.live_pip) +
      n(form.dead_pip) +
      n(form.unhatched) +
      n(form.rotten) +
      n(form.exploder) +
      n(form.unhatched_good) +
      n(form.unhatched_bad) +
      n(form.infertile_good) +
      n(form.infertile_bad)
    );
  }, [form]);

  const qualityRatePreview = useMemo(() => {
    if (totalChicksPreview <= 0) return "";
    return ((goodQualityPreview / totalChicksPreview) * 100).toFixed(2);
  }, [goodQualityPreview, totalChicksPreview]);

  const cullRatePreview = useMemo(() => {
    if (totalChicksPreview <= 0) return "";
    return ((n(form.cull_chicks) / totalChicksPreview) * 100).toFixed(2);
  }, [form.cull_chicks, totalChicksPreview]);

  async function onSave() {
    if (!form.egg_ref_no.trim()) {
      alert("Egg Reference No. is required.");
      return;
    }

    if (!form.batch_code.trim()) {
      alert("Batch code is required.");
      return;
    }

    const totalChicks = n(form.total_chicks);
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
      const payload: ChickGradingProcessCreate = {
        egg_ref_no: form.egg_ref_no.trim() || null,
        batch_code: form.batch_code.trim(),
        grading_datetime: form.grading_datetime || new Date().toISOString(),
        grading_personnel: form.grading_personnel.trim() || null,

        class_a: n(form.class_a),
        class_b: n(form.class_b),
        class_a_junior: n(form.class_a_junior),
        class_c: n(form.class_c),
        cull_chicks: n(form.cull_chicks),
        dead_chicks: n(form.dead_chicks),
        infertile: n(form.infertile),
        dead_germ: n(form.dead_germ),
        live_pip: n(form.live_pip),
        dead_pip: n(form.dead_pip),
        unhatched: n(form.unhatched),
        rotten: n(form.rotten),
        exploder: n(form.exploder),
        unhatched_good: n(form.unhatched_good),
        unhatched_bad: n(form.unhatched_bad),
        infertile_good: n(form.infertile_good),
        infertile_bad: n(form.infertile_bad),

        chick_room_temperature:
          form.chick_room_temperature === null ||
            form.chick_room_temperature === undefined
            ? null
            : Number(form.chick_room_temperature),
      };
      console.log({ payload })
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

  return (
    <div className="w-full px-6 py-6 mt-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="DOC Classification"
        CurrentPageName={isEdit ? "Edit Entry" : "New DOC Classification"}
      />

      <Card className="w-full min-h-[calc(90vh-120px)] p-6 space-y-4 mt-2">
        <CardContent className="max-w-2xl p-4 space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <RequiredLabel>Egg Reference No.</RequiredLabel>
                    <SearchableDropdown
                      list={eggRefs}
                      codeLabel="egg_ref_no"
                      nameLabel="egg_ref_no"
                      showNameOnly
                      value={form.egg_ref_no}
                      onChange={(val) => setField("egg_ref_no", val)}
                      disabled={saving || eggRefsLoading}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Batch Code</Label>
                    <Input
                      value={batchLoading ? "Generating..." : form.batch_code}
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
                    <Label>Total Egg Set</Label>
                    <Input
                      value={
                        totalLoading
                          ? "Loading..."
                          : formatNumber(remainingInventory)
                      }
                      disabled
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Grading Personnel</Label>
                    <Input
                      value={form.grading_personnel}
                      onChange={(e) =>
                        setField("grading_personnel", e.target.value)
                      }
                      disabled
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <Label>Quality: Class A</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.class_a)}
                        onChange={handleNumberChange("class_a")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Quality: Class A Junior</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.class_a_junior)}
                        onChange={handleNumberChange("class_a_junior")}
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
                        onChange={handleNumberChange("infertile")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Live Pip</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.live_pip)}
                        onChange={handleNumberChange("live_pip")}
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
                        onChange={handleNumberChange("cull_chicks")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Unhatched Good</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.unhatched_good)}
                        onChange={handleNumberChange("unhatched_good")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Unhatched Bad</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.unhatched_bad)}
                        onChange={handleNumberChange("unhatched_bad")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Infertile Good</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.infertile_good)}
                        onChange={handleNumberChange("infertile_good")}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <Label>Quality: Class B</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.class_b)}
                        onChange={handleNumberChange("class_b")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Quality: Class C – Abnormal / Reject</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.class_c)}
                        onChange={handleNumberChange("class_c")}
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
                        onChange={handleNumberChange("dead_chicks")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Dead Germ</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.dead_germ)}
                        onChange={handleNumberChange("dead_germ")}
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
                        onChange={handleNumberChange("dead_pip")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Rotten</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.rotten)}
                        onChange={handleNumberChange("rotten")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Infertile Bad</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.infertile_bad)}
                        onChange={handleNumberChange("infertile_bad")}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Exploder</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(form.exploder)}
                        onChange={handleNumberChange("exploder")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Good Quality Chicks</Label>
                    <Input value={String(goodQualityPreview)} disabled />
                  </div>

                  <div className="space-y-1">
                    <Label>Total By Product and For Dispose</Label>
                    <Input value={String(totalByProductPreview)} disabled />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Quality Grade Rate %</Label>
                    <Input value={qualityRatePreview} disabled />
                  </div>

                  <div className="space-y-1">
                    <Label>Cull Rate %</Label>
                    <Input value={cullRatePreview} disabled />
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
