/**
 * Hatchery Classification Form Component
 *
 * A comprehensive form for creating and editing hatchery egg classification records.
 * Manages egg grading data including counts for various classification categories
 * (hatching eggs, cracks, condemns, size variations, etc.) and automatically calculates
 * totals, discrepancies, and egg recovery percentages.
 *
 * @component
 * @example
 * // For creating a new classification
 * <Hatchform />
 *
 * @example
 * // For editing an existing classification (via URL param ?id=123)
 * <Hatchform />
 *
 * @remarks
 * - Breeder reference data is loaded from the "viewforhatcheryclassi" view
 * - Classification reference numbers are auto-generated via RPC "generate_hatch_classi_ref"
 * - Selecting a breeder auto-populates DR No., DR Date, Temperature, SKU, UOM, and Total Count
 * - All numeric egg count fields are validated to prevent negative values
 * - Total Classify must equal Total Count before saving
 * - Percentage Egg Recovery = (Hatching Eggs / Total Count) × 100
 * - Supports both CREATE (new) and UPDATE (edit) operations via Supabase
 *
 * @requires Supabase client configured at "@/lib/Supabase/supabaseClient"
 * @requires API functions from "./api" (createHatchClassification, updateHatchClassification, getHatchClassificationById)
 *
 * @state {FormState} form - Current form state containing all classification and view data
 * @state {ViewForHatcheryClassi[]} breeders - Available breeder records for dropdown selection
 * @state {boolean} saving - Indicates if form submission is in progress
 * @state {boolean} loading - Indicates if record is being loaded for editing
 * @state {boolean} refLoading - Indicates if classification reference number is being generated
 *
 * @uses useRouter, useSearchParams from "next/navigation"
 * @uses useState, useEffect, useMemo from "react"
 * @uses SearchableDropdown component for breeder selection
 * @uses FormActionButtons component for save/cancel actions
 * @uses toast from "sonner" for notifications
 */
"use client";

import React, { useEffect, useMemo, useState, ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/Supabase/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createHatchClassification,
  updateHatchClassification,
  getHatchClassificationById,
  type HatchClassificationInsert,
  type HatchClassificationUpdate,
} from "./api";
import FormActionButtons from "@/components/FormActionButtons";
import SearchableDropdown from "@/lib/SearchableDropdown";
import Breadcrumb from "@/lib/Breadcrumb";
import RequiredLabel from "@/components/RequiredLabel";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ViewForHatcheryClassi = {
  id: string | null;
  dr_num: string | null;
  doc_date: string | null;
  temperature: string | null;
  humidity: string | null;
  brdr_ref_no: string | null;
  sku: string | null;
  itemcodedesc: string | null;
  UoM: string | null;
  actual_count: number | null;
  classfi_ref_no: string | null;
  farm_id: string | null;
  farm_name: string | null;
  ttlclassify: number | null;
  ttlremaining: number | null;
};

type FormState = {
  br_no: string;
  dr_no: string;
  dr_date: string;
  temperature: string;
  itemcodedesc: string;
  sku: string;
  uom: string;
  total_count_view: number;
  classfi_ref_no: string;
  classi_ref_no: string;
  date_classify: string;
  good_egg: number;
  trans_crack: number;
  trans_condemn: number;
  hatc_crack: number;
  thin_shell: number;
  hatc_condemn: number;
  small: number;
  pee_wee: number;
  d_yolk: number;
  jumbo: number;
  misshapen: number;
  leakers: number;
  dirties: number;
  ttl_count: number;
  discrepancy: number;
  percentage_egg_recovery: number;
  farm_id?: number;
  hairline?: number;
  farm_name: string;
  ttlclassify: number;
  ttlremaining: number;
};

const emptyForm: FormState = {
  br_no: "",
  dr_no: "",
  dr_date: "",
  temperature: "",
  sku: "",
  itemcodedesc: "",
  uom: "",
  total_count_view: 0,
  classfi_ref_no: "",
  classi_ref_no: "",
  date_classify: "",
  good_egg: 0,
  trans_crack: 0,
  trans_condemn: 0,
  hatc_crack: 0,
  thin_shell: 0,
  hatc_condemn: 0,
  small: 0,
  pee_wee: 0,
  d_yolk: 0,
  jumbo: 0,
  misshapen: 0,
  leakers: 0,
  dirties: 0,
  ttl_count: 0,
  discrepancy: 0,
  percentage_egg_recovery: 0,
  farm_id: 0,
  hairline: 0,
  farm_name: "",
  ttlclassify: 0,
  ttlremaining: 0,
};

export default function Hatchform() {
  const router = useRouter();
  const sp = useSearchParams();
  const idParam = sp.get("id");
  const id = idParam ? Number(idParam) : null;
  const isEdit = !!id;

  const [breeders, setBreeders] = useState<ViewForHatcheryClassi[]>([]);
  const [saving, setSaving] = useState(false);
  const [refLoading, setRefLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<FormState>(emptyForm);

  const numericFields = useMemo(
    () => [
      { label: "Hatching Egg", name: "good_egg" },
      { label: "Transport Crack", name: "trans_crack" },
      { label: "Transport Condemn", name: "trans_condemn" },
      { label: "Hatch Crack", name: "hatc_crack" },
      { label: "Thin Shell", name: "thin_shell" },
      { label: "Hatch Condemn", name: "hatc_condemn" },
      { label: "Small", name: "small" },
      { label: "Pee Wee", name: "pee_wee" },
      { label: "Double Yolk", name: "d_yolk" },
      { label: "Jumbo", name: "jumbo" },
      { label: "Misshapen", name: "misshapen" },
      { label: "Leakers", name: "leakers" },
      { label: "Dirties", name: "dirties" },
      { label: "Hairline", name: "hairline" },
    ],
    [],
  );

  // --- helpers
  const recalcTotals = (draft: FormState) => {
    const total = numericFields.reduce(
      (sum, f) => sum + Number((draft as any)[f.name] || 0),
      0,
    );
    draft.ttl_count = total;
    draft.discrepancy = Number(draft.total_count_view || 0) - total;

    // Calculate Percentage Egg Recovery
    // By-Products = total egg except Hatching Egg
    // Percentage Egg Recovery = (Total Count - By-Products) / Total Count = Hatching Egg / Total Count
    const totalCount = Number(draft.total_count_view || 0);
    const hatchingEgg = Number(draft.good_egg || 0);

    if (totalCount > 0) {
      draft.percentage_egg_recovery = (hatchingEgg / totalCount) * 100;
    } else {
      draft.percentage_egg_recovery = 0;
    }
  };

  // load viewforhatcheryclassi list
  useEffect(() => {
    const loadBreeders = async () => {
      const { data, error } = await db
        .from("viewforhatcheryclassi")
        .select(
          "itemcodedesc,dr_num,doc_date,temperature,humidity,brdr_ref_no,sku,UoM,actual_count,classfi_ref_no,farm_id,farm_name,ttlclassify,ttlremaining",
        )
        .order("doc_date", { ascending: false });

      if (!error && data) setBreeders(data as any);
      if (error) console.error(error);
    };
    loadBreeders();
  }, []);

  useEffect(() => {
    refreshSessionx(router);
  }, []);
  // load record when editing
  useEffect(() => {
    const run = async () => {
      if (!isEdit || !id) return;
      try {
        setLoading(true);
        const row = await getHatchClassificationById(id);
        console.log("Loaded hatch classification:", row);
        // NOTE: row must include at least these columns from hatch_classification table:
        // br_no, date_classify, classi_ref_no, good_egg... jumbo, ttl_count
        // If you want view fields (dr_no, dr_date, temperature, sku, uom, total_count_view),
        // we infer them from breeders list when possible via br_no.
        const base = { ...emptyForm };

        base.br_no = row.br_no ?? "";
        base.date_classify = (row.date_classify ?? "") as string;
        base.classi_ref_no = row.classi_ref_no ?? "";

        base.good_egg = Number(row.good_egg ?? 0);
        base.trans_crack = Number(row.trans_crack ?? 0);
        base.trans_condemn = Number(row.trans_condemn ?? 0);
        base.hatc_crack = Number(row.hatc_crack ?? 0);
        base.thin_shell = Number(row.thin_shell ?? 0);
        base.hatc_condemn = Number(row.hatc_condemn ?? 0);
        base.small = Number(row.small ?? 0);
        base.pee_wee = Number(row.pee_wee ?? 0);
        base.d_yolk = Number(row.d_yolk ?? 0);
        base.jumbo = Number(row.jumbo ?? 0);
        base.misshapen = Number(row.misshapen ?? 0);
        base.leakers = Number(row.leakers ?? 0);
        base.dirties = Number(row.dirties ?? 0);
        base.hairline = Number(row.hairline ?? 0);

        // Try to populate "view" fields from the breeders view by br_no
        const selected = breeders.find((b) => b.brdr_ref_no === base.br_no);
        if (selected) {
          base.dr_no = selected.dr_num ?? "";
          base.dr_date = selected.doc_date ?? "";
          base.temperature = selected.temperature ?? "";
          base.sku = selected.sku ?? "";
          base.itemcodedesc = selected.itemcodedesc ?? "";
          base.uom = selected.UoM ?? "";
          base.total_count_view = Number(selected.actual_count ?? 0);
          base.classfi_ref_no = selected.classfi_ref_no ?? "";
          base.farm_id = Number(selected.farm_id ?? 0);
          base.farm_name = selected.farm_name ?? "";
          base.ttlclassify = Number(selected.ttlclassify ?? 0);
          base.ttlremaining = Number(selected.ttlremaining ?? 0);
        }

        recalcTotals(base);
        setForm(base);
      } catch (e: any) {
        console.error(e);
        alert(e?.message ?? "Failed to load record.");
      } finally {
        setLoading(false);
      }
    };

    run();
    // we intentionally depend on breeders, so when breeders load later it can fill view fields
  }, [isEdit, id, breeders]);

  // RPC generate classi_ref_no
  const generateRef = async (dateClassify: string, baseRef: string) => {
    const { data, error } = await db.rpc("generate_hatch_classi_ref", {
      p_date_classify: dateClassify,
      p_classfi_ref_no: baseRef,
    });
    if (error) throw error;
    return data?.[0]?.classi_ref_no as string;
  };

  // date_classify/classfi_ref_no change -> auto generate (but don't override existing edit ref unless needed)
  useEffect(() => {
    const run = async () => {
      if (!form.date_classify) return;
      if (!form.classfi_ref_no) return;

      // If editing and already has a ref, keep it unless user is changing date and we want to regenerate.
      // We’ll regenerate only when classi_ref_no is empty.
      if (isEdit && form.classi_ref_no) return;

      try {
        setRefLoading(true);
        const finalRef = await generateRef(
          form.date_classify,
          form.classfi_ref_no,
        );
        setForm((p) => ({ ...p, classi_ref_no: finalRef }));
      } catch (e: any) {
        console.error(
          "RPC generate_hatch_classi_ref failed:",
          e?.message ?? e,
          e,
        );
        setForm((p) => ({ ...p, classi_ref_no: "" }));
        alert(e?.message ?? "Failed to generate Classification Ref No.");
      } finally {
        setRefLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date_classify, form.classfi_ref_no, isEdit]);

  // breeder selected -> auto populate view fields
  const handleBreederChange = async (value: string) => {
    const selected = breeders.find((b) => b.brdr_ref_no === value);
    console.log({ selected });
    if (!selected) return;

    const baseRef = selected.classfi_ref_no ?? "";
    const dateClassify = form.date_classify;

    setForm((prev) => {
      const next = {
        ...prev,
        br_no: selected.brdr_ref_no ?? "",
        dr_no: selected.dr_num ?? "",
        dr_date: selected.doc_date ?? "",
        temperature: selected.temperature ?? "",
        sku: selected.sku ?? "",
        farm_id: Number(selected.farm_id ?? 0),
        farm_name: selected.farm_name ?? "",
        // sku: selected.sku ?? "",
        itemcodedesc: selected.itemcodedesc ?? "",
        uom: selected.UoM ?? "",
        total_count_view: Number(selected.actual_count ?? 0),
        classfi_ref_no: baseRef,
        // For NEW record we reset and generate; for EDIT we keep existing unless you want to force regenerate
        classi_ref_no: isEdit ? prev.classi_ref_no : "",
      } as FormState;

      recalcTotals(next);
      return next;
    });

    // auto-generate only for NEW (or if editing but classi_ref_no empty)
    if (!dateClassify || !baseRef) return;
    if (isEdit && form.classi_ref_no) return;

    try {
      setRefLoading(true);
      const finalRef = await generateRef(dateClassify, baseRef);
      setForm((prev) => ({ ...prev, classi_ref_no: finalRef }));
    } catch (e: any) {
      console.error(
        "RPC generate_hatch_classi_ref failed:",
        e?.message ?? e,
        e,
      );
      setForm((prev) => ({ ...prev, classi_ref_no: "" }));
      alert(e?.message ?? "Failed to generate Classification Ref No.");
    } finally {
      setRefLoading(false);
    }
  };

  // inputs
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;

    setForm((prev) => {
      const updated: any = { ...prev };

      if (type === "number") {
        if (value === "") {
          updated[name] = 0;
        } else {
          let n = Number(value);
          if (!Number.isFinite(n)) n = 0;
          if (n < 0) n = 0;
          updated[name] = n;
        }
      } else {
        updated[name] = value;
      }

      recalcTotals(updated);
      return updated;
    });
  };

  const validateBeforeSave = () => {
    if (!form.br_no || form.br_no.trim() === "") {
      alert("Please select Breeder Ref. No.");
      return false;
    }
    if (!form.date_classify) {
      alert("Please fill Date Classify.");
      return false;
    }
    if (!form.classi_ref_no) {
      alert("Classification Ref. No. not generated yet.");
      return false;
    }
    // if (Number(form.ttl_count) !== Number(form.total_count_view)) {
    //   alert("Total Classify must be equal to Total Count.");
    //   return false;
    // }
    return true;
  };

  const handleSave = async () => {
    if (!validateBeforeSave()) return;

    try {
      setSaving(true);

      if (isEdit && id) {
        const payload: HatchClassificationUpdate = {
          updated_at: new Date().toISOString(),
          date_classify: form.date_classify,
          classi_ref_no: form.classi_ref_no || null,
          br_no: form.br_no,

          good_egg: form.good_egg,
          trans_crack: form.trans_crack,
          trans_condemn: form.trans_condemn,
          hatc_crack: form.hatc_crack,
          thin_shell: form.thin_shell,
          hatc_condemn: form.hatc_condemn,
          small: form.small,
          pee_wee: form.pee_wee,
          d_yolk: form.d_yolk,
          jumbo: form.jumbo,
          misshapen: form.misshapen,
          leakers: form.leakers,
          dirties: form.dirties,
          hairline: form.hairline,
          ttl_count: form.ttl_count,
          is_active: true,
        };

        await updateHatchClassification(id, payload);
        router.push("/jmb/hatcheryclassi");
        return;
      }

      const payload: HatchClassificationInsert = {
        created_at: new Date().toISOString(),
        date_classify: form.date_classify,
        classi_ref_no: form.classi_ref_no || null,
        br_no: form.br_no,
        good_egg: form.good_egg,
        trans_crack: form.trans_crack,
        trans_condemn: form.trans_condemn,
        hatc_crack: form.hatc_crack,
        thin_shell: form.thin_shell,
        hatc_condemn: form.hatc_condemn,
        small: form.small,
        pee_wee: form.pee_wee,
        d_yolk: form.d_yolk,
        jumbo: form.jumbo,
        misshapen: form.misshapen,
        leakers: form.leakers,
        dirties: form.dirties,
        ttl_count: form.ttl_count,
        is_active: true,
        farm_id: form.farm_id ? Number(form.farm_id) : null,
        hairline: form.hairline ?? null,
      };

      await createHatchClassification(payload);
      router.push("/jmb/hatcheryclassi");
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const disabledAll = saving || loading;

  return (
    <div className="space-y-4 mt-8">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="Egg Classification"
        CurrentPageName={isEdit ? "Edit Classification" : "New Classification"}
      />
      {/* <Button onClick={()=> toast("test")}>Toast test</Button>
      // toast example */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-1 max-w-sm">
            <RequiredLabel>Breeder Ref. No.</RequiredLabel>
            <SearchableDropdown
              list={breeders}
              codeLabel="brdr_ref_no"
              nameLabel="brdr_ref_no"
              showNameOnly
              value={form.br_no}
              onChange={(val) => handleBreederChange(val)}
              // disabled={disabledAll}
            />
          </div>

          <Separator />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <DisabledField label="Hatchery ID" value={form.farm_id} />
            <DisabledField label="Hatchery Name" value={form.farm_name} />
            <DisabledField label="DR No." value={form.dr_no} />
            <DisabledField label="DR Date" value={form.dr_date} />
            <DisabledField label="Temperature" value={form.temperature} />
            <DisabledField label="SKU" value={form.itemcodedesc} />
            <DisabledField label="UOM" value={form.uom} />
           
            <DisabledField
              label="Total Received"
              value={form.total_count_view}
            />
              <DisabledField label="Ttl Classified" value={form.ttlclassify} />
              <DisabledField label="Ttl Remaining" value={form.ttlremaining} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-2 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-3 md:col-span-1">
              <RequiredLabel>Classification Date</RequiredLabel>
              <Input
                type="date"
                name="date_classify"
                value={form.date_classify}
                onChange={handleChange}
                disabled={disabledAll}
              />
            </div>

            <div className="space-y-1">
              <RequiredLabel>Classification Ref. No.</RequiredLabel>
              <Input
                value={
                  refLoading ? "Generating..." : (form.classi_ref_no ?? "")
                }
                disabled
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <NumberField
                label="Hatching Egg"
                name="good_egg"
                placeholder="0"
                form={form}
                onChange={handleChange}
                disabled={disabledAll}
                min={0}
              />
            </div>
            <div className="md:col-span-2" />

            <NumberField
              label="Transport Crack"
              name="trans_crack"
              placeholder="0"
              form={form}
              onChange={handleChange}
              disabled={disabledAll}
            />
            <NumberField
              label="Transport Condemn"
              name="trans_condemn"
              placeholder="0"
              form={form}
              onChange={handleChange}
              disabled={disabledAll}
            />
            <div />

            <NumberField
              label="Hatch Crack"
              name="hatc_crack"
              placeholder="0"
              form={form}
              onChange={handleChange}
              disabled={disabledAll}
            />
            <NumberField
              label="Thin Shell"
              name="thin_shell"
              placeholder="0"
              form={form}
              onChange={handleChange}
              disabled={disabledAll}
            />
            <NumberField
              label="Hatch Condemn"
              name="hatc_condemn"
              placeholder="0"
              form={form}
              onChange={handleChange}
              disabled={disabledAll}
            />

            <NumberField
              label="Small"
              name="small"
              placeholder="0"
              form={form}
              onChange={handleChange}
              disabled={disabledAll}
            />
            <NumberField
              label="Pee Wee"
              name="pee_wee"
              placeholder="0"
              form={form}
              onChange={handleChange}
              disabled={disabledAll}
            />
            <NumberField
              label="Double Yolk"
              name="d_yolk"
              placeholder="0"
              form={form}
              onChange={handleChange}
              disabled={disabledAll}
            />

            <div className="md:col-span-1">
              <NumberField
                label="Jumbo"
                name="jumbo"
                placeholder="0"
                form={form}
                onChange={handleChange}
                disabled={disabledAll}
              />
            </div>
            <div className="md:col-span-1">
              <NumberField
                label="Misshapen"
                name="misshapen"
                placeholder="0"
                form={form}
                onChange={handleChange}
                disabled={disabledAll}
              />
            </div>
            <div className="md:col-span-1">
              <NumberField
                label="Leakers"
                name="leakers"
                placeholder="0"
                form={form}
                onChange={handleChange}
                disabled={disabledAll}
              />
            </div>
            <div className="md:col-span-1">
              <NumberField
                label="Dirties"
                name="dirties"
                placeholder="0"
                form={form}
                onChange={handleChange}
                disabled={disabledAll}
              />
            </div>
            <div className="md:col-span-1">
              <NumberField
                label="Hairline"
                name="hairline"
                placeholder="0"
                form={form}
                onChange={handleChange}
                disabled={disabledAll}
              />
            </div>
            <div className="md:col-span-2" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <NumberField
              label="Total Classify"
              name="ttl_count"
              form={form}
              disabled
            />
            <NumberField
              label="Discrepancy"
              name="discrepancy"
              form={form}
              disabled
            />
            <NumberField
              label="Percentage Egg Recovery"
              name="percentage_egg_recovery"
              form={form}
              disabled
              suffix="%"
              placeholder="0%"
            />
          </div>

          <FormActionButtons
            saving={saving}
            isEdit={isEdit}
            disabled={disabledAll}
            cancelPath="/jmb/hatcheryclassi"
            onSave={handleSave}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function DisabledField({ label, value }: any) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={value ?? ""} disabled />
    </div>
  );
}

function NumberField({
  label,
  name,
  placeholder,
  form,
  onChange,
  disabled = false,
  min = 0,
  suffix,
}: any) {
  const blockBadKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "+") {
      e.preventDefault();
    }
  };

  const blockNegativePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const txt = e.clipboardData.getData("text");
    if (txt.includes("-") || /[eE+]/.test(txt)) {
      e.preventDefault();
      return;
    }
    const n = Number(txt);
    if (Number.isFinite(n) && n < 0) e.preventDefault();
  };

  const displayValue = suffix
    ? `${form[name] ?? ""}${suffix}`
    : (form[name] ?? "");

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (suffix) {
      let v = e.target.value;
      if (v.endsWith(suffix)) v = v.slice(0, -suffix.length);
      const fakeEvent = {
        ...e,
        target: { ...e.target, value: v },
      } as ChangeEvent<HTMLInputElement>;
      onChange(fakeEvent);
    } else {
      onChange(e);
    }
  };

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type={suffix ? "text" : "number"}
        name={name}
        placeholder={placeholder}
        disabled={disabled}
        value={displayValue}
        onChange={handleInputChange}
        min={min}
        step={1}
        inputMode={suffix ? "text" : "numeric"}
        onKeyDown={blockBadKeys}
        onPaste={blockNegativePaste}
        onFocus={(e) => e.target.select()}
      />
    </div>
  );
}
