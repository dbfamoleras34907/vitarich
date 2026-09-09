/**
 * DocdispatchForm - A comprehensive form component for managing DOC (Day-Old Chick) dispatch documents.
 *
 * This component handles:
 * - Creation and editing of dispatch delivery receipts
 * - Management of chick grading quantities by batch code
 * - Dynamic SKU (Stock Keeping Unit) selection with auto-classification
 * - Hauler, farm, and truck information management
 * - Multi-item line entry with validation
 *
 * @component
 *
 * @remarks
 * - Uses Next.js App Router for navigation and query parameters
 * - Implements session refresh on component mount
 * - Maintains a cache of chick grading data to minimize API calls
 * - Prevents auto-generation of DR number once user manually edits it
 * - Supports both create and edit modes based on URL query parameter `id`
 *
 * @example
 * ```tsx
 * // New dispatch document
 * <DocdispatchForm />
 *
 * // Edit existing document (via URL: ?id=123)
 * <DocdispatchForm />
 * ```
 *
 * @state
 * - `form` - Main header information (date, DR no, farm, hauler details, etc.)
 * - `itemDraft` - Current item being composed before adding to list
 * - `items` - Array of added dispatch items
 * - `gradingCache` - Cache of batch code to ChickGradingQtyRow mapping
 * - `loading` - Loading state for fetching existing record
 * - `saving` - Saving state during form submission
 * - `haulers` - List of available haulers from dropdown
 * - `docBatchCodes` - List of available DOC batch codes
 * - `boilerFarms` - List of available boiler farm options
 *
 * @returns {JSX.Element} A form interface for DOC dispatch management with breadcrumb navigation and validation
 */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Send, Trash2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import Breadcrumb from "@/lib/Breadcrumb";

import {
  createDispatchDoc,
  getDispatchDocById,
  postDispatchDoc,
  updateDispatchDoc,
  listDistinctHaulers,
  type DispatchDocItemInsert,
  type SkuClassification,
  type UomType,
  generateNextDrNo,
  listDocBatchCodes,
} from "./api";
import type { ChickGradingQtyRow } from "./api";
import { getChickGradingQtyByBatchCode } from "./api";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import RequiredLabel from "@/components/RequiredLabel";
import SearchableDropdown from "@/lib/SearchableDropdown";
import { listBroilerFarmOptions, type BroilerFarmOption } from "@/lib/data/repositories/farmOptions.client";

type FormState = {
  doc_date: string; // YYYY-MM-DD
  dr_no: string;
  farm_name: string;
  destination_farm_id: number | null;
  destination_farm_code: string;
  address: string;
  hauler_name: string;
  hauler_plate_no: string;
  truck_seal_no: string;
  chick_van_temp_c: string;
  number_of_fans: string;
  remarks: string;
};

type ItemDraft = {
  doc_batch_code: string;
  sku_name: string;
  classification: SkuClassification | "";
  uom: UomType | "";
  qty: string;
};

type SkuOption = {
  sku_name: string;
  classification: SkuClassification;
};
const SKU_TO_FIELD: Record<string, keyof ChickGradingQtyRow> = {
  "Class A": "class_a",
  "Class B": "class_b",
  "Class A Junior": "class_a_junior",
  "Class C": "class_c",

  Infertile: "infertile",
  "Live PIP": "live_pip",
  "Dead Chick": "dead_chicks",
  "Dead Germ": "dead_germ",

  "Cull Chick": "cull_chicks",
  Unhatched: "unhatched",
  "Dead Pip": "dead_pip",
  Rotten: "rotten",
};

const SKU_OPTIONS: SkuOption[] = [
  { sku_name: "Class A", classification: "SALEABLE" },

  { sku_name: "Class A Junior", classification: "BY_PRODUCT" },
  { sku_name: "Class B", classification: "BY_PRODUCT" },
  { sku_name: "Class C", classification: "BY_PRODUCT" },
  { sku_name: "Infertile", classification: "BY_PRODUCT" },
  { sku_name: "Live PIP", classification: "BY_PRODUCT" },
  { sku_name: "Dead Chick", classification: "BY_PRODUCT" },
  { sku_name: "Dead Germ", classification: "BY_PRODUCT" },

  // { sku_name: "Cull Chick", classification: "DISPOSAL" },
  // { sku_name: "Unhatched", classification: "DISPOSAL" },
  // { sku_name: "Dead Pip", classification: "DISPOSAL" },
  // { sku_name: "Rotten", classification: "DISPOSAL" },
];

function todayYMD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function clampNonNegStringToNumberOrNull(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, n);
}

function clampNonNegString(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return String(Math.max(0, n));
}

function labelClassification(v: SkuClassification | "" | null | undefined) {
  if (!v) return "";
  if (v === "SALEABLE") return "SALEABLE DOC";
  if (v === "BY_PRODUCT") return "BY-PRODUCT";
  if (v === "DISPOSAL") return "DISPOSAL";
  return String(v);
}

export default function DocdispatchForm() {
  const [gradingCache, setGradingCache] = useState<
    Record<string, ChickGradingQtyRow | null>
  >({});
  const router = useRouter();
  const sp = useSearchParams();
  const idParam = sp.get("id");

  const editId = useMemo(() => (idParam ? Number(idParam) : null), [idParam]);
  const isEdit = !!editId;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"Draft" | "Posted">("Draft");
  const readOnly = status === "Posted";

  const [haulers, setHaulers] = useState<string[]>([]);
  const [haulersLoading, setHaulersLoading] = useState(false);

  const [docBatchCodes, setDocBatchCodes] = useState<string[]>([]);
  const [docBatchLoading, setDocBatchLoading] = useState(false);

  const [boilerFarms, setBoilerFarms] = useState<BroilerFarmOption[]>([]);
  const [boilerFarmsLoading, setBoilerFarmsLoading] = useState(false);

  // if user manually edits DR no, we stop auto-overwriting
  const drManualRef = useRef(false);

  const [form, setForm] = useState<FormState>({
    doc_date: todayYMD(),
    dr_no: "",
    farm_name: "",
    destination_farm_id: null,
    destination_farm_code: "",
    address: "",
    hauler_name: "",
    hauler_plate_no: "",
    truck_seal_no: "",
    chick_van_temp_c: "",
    number_of_fans: "",
    remarks: "",
  });

  const [itemDraft, setItemDraft] = useState<ItemDraft>({
    doc_batch_code: "",
    sku_name: "",
    classification: "",
    uom: "PCS",
    qty: "",
  });

  const [items, setItems] = useState<DispatchDocItemInsert[]>([]);

  const totalQty = useMemo(() => {
    return items.reduce(
      (sum, it) => sum + (Number.isFinite(it.qty) ? it.qty : 0),
      0,
    );
  }, [items]);

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function setDraft<K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) {
    setItemDraft((p) => ({ ...p, [k]: v }));
  }

  function handleFarmChange(farmCode: string, selected: BroilerFarmOption) {

    setForm((prev) => ({
      ...prev,
      destination_farm_id: selected.id,
      destination_farm_code: farmCode,
      farm_name: selected.name,
      address: selected?.address ?? "",
    }));
  }

  async function ensureGradingRow(batch_code: string) {
    const code = batch_code.trim();
    if (!code) return null;

    if (code in gradingCache) return gradingCache[code];

    const row = await getChickGradingQtyByBatchCode(code);
    setGradingCache((p) => ({ ...p, [code]: row }));
    return row;
  }

  useEffect(() => {
    refreshSessionx(router);
  }, []);

  // ✅ load dropdowns
  useEffect(() => {
    let alive = true;
    (async () => {
      setHaulersLoading(true);
      setDocBatchLoading(true);
      setBoilerFarmsLoading(true);

      try {
        const [h, b, farms] = await Promise.all([
          listDistinctHaulers(),
          listDocBatchCodes(),
          listBroilerFarmOptions(),
        ]);

        if (!alive) return;

        setHaulers(h);
        setDocBatchCodes(b);
        setBoilerFarms(farms);
      } catch (e) {
        console.error(e);
        if (!alive) return;

        setHaulers([]);
        setDocBatchCodes([]);
        setBoilerFarms([]);
      } finally {
        if (alive) {
          setHaulersLoading(false);
          setDocBatchLoading(false);
          setBoilerFarmsLoading(false);
        }
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
        const res = await getDispatchDocById(editId);
        if (!res) return;

        const { header, items } = res;

        // editing: treat as manual (don’t auto-generate)
        drManualRef.current = true;

        setForm({
          doc_date: header.doc_date,
          dr_no: header.dr_no ?? "",
          farm_name: header.farm_name ?? "",
          destination_farm_id: header.destination_farm_id ?? null,
          destination_farm_code: header.destination_farm_code ?? "",
          address: header.address ?? "",
          hauler_name: header.hauler_name ?? "",
          hauler_plate_no: header.hauler_plate_no ?? "",
          truck_seal_no: header.truck_seal_no ?? "",
          chick_van_temp_c:
            header.chick_van_temp_c == null
              ? ""
              : String(header.chick_van_temp_c),
          number_of_fans:
            header.number_of_fans == null ? "" : String(header.number_of_fans),
          remarks: header.remarks ?? "",
        });
        setStatus(header.status ?? "Draft");
        setItems(
          (items ?? []).map((it) => ({
            doc_batch_code: it.doc_batch_code,
            sku_name: it.sku_name,
            classification: it.classification,
            uom: it.uom,
            qty: Number(it.qty ?? 0),
          })),
        );
      } catch (e) {
        console.error(e);
        alert("Failed to load record.");
      } finally {
        setLoading(false);
      }
    })();
  }, [editId]);

  // ✅ auto-generate DR (new record only)
  useEffect(() => {
    if (isEdit) return;
    if (drManualRef.current) return;
    if (!form.doc_date) return;

    let alive = true;
    (async () => {
      try {
        const dr = await generateNextDrNo(form.doc_date);
        if (!alive) return;
        setForm((p) => ({ ...p, dr_no: dr }));
      } catch (e) {
        console.error(e);
        // keep empty if RPC fails
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.doc_date, isEdit]);

  // ✅ when SKU changes: auto set classification (and keep it locked)
  async function handleSkuChange(skuName: string) {
    const found = SKU_OPTIONS.find((x) => x.sku_name === skuName);

    // set sku + classification first
    setItemDraft((p) => ({
      ...p,
      sku_name: skuName,
      classification: found?.classification ?? "",
    }));

    // auto-fill qty using selected batch code
    const batch = itemDraft.doc_batch_code?.trim();
    if (!batch) return; // must select batch code first

    try {
      const row = await ensureGradingRow(batch);
      if (!row) return;

      const field = SKU_TO_FIELD[skuName];
      if (!field) return;

      const qty = row[field];
      const qtyStr = String(Math.max(0, Number(qty ?? 0)));

      setItemDraft((p) => ({
        ...p,
        qty: qtyStr,
      }));
    } catch (e) {
      console.error(e);
    }
  }

  function addItem() {
    const doc_batch_code = itemDraft.doc_batch_code.trim();
    const sku_name = itemDraft.sku_name.trim();
    const qtyN = clampNonNegStringToNumberOrNull(itemDraft.qty);

    if (!doc_batch_code) return alert("DOC Batch Code is required.");
    if (!sku_name) return alert("SKU Name is required.");
    if (!itemDraft.classification)
      return alert("SKU Classification is required.");
    if (qtyN == null) return alert("Qty is required.");

    setItems((prev) => [
      ...prev,
      {
        doc_batch_code,
        sku_name,
        classification: itemDraft.classification as SkuClassification,
        uom: itemDraft.uom || null,
        qty: qtyN,
      },
    ]);

    setItemDraft((p) => ({
      ...p,
      sku_name: "",
      classification: "",
      qty: "",
    }));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSave(post = false) {
    if (!form.doc_date) return alert("Date is required.");
    if (!form.dr_no.trim()) return alert("Delivery Receipt No. is required.");
    if (!form.farm_name.trim()) return alert("Destination Farm is required.");
    if (!form.destination_farm_code.trim()) return alert("Select a valid destination farm code.");
    if (!items.length) return alert("Please add at least 1 item.");
    if (post && !window.confirm("Post this DOC Dispatch? Posted dispatches can no longer be edited.")) return;

    setSaving(true);
    let draftSaved = false;
    try {
      const payload = {
        doc_date: form.doc_date,
        dr_no: form.dr_no.trim(),
        farm_name: form.farm_name.trim(),
        destination_farm_code: form.destination_farm_code.trim(),
        address: form.address.trim() || null,
        hauler_name: form.hauler_name.trim() || null,
        hauler_plate_no: form.hauler_plate_no.trim() || null,
        truck_seal_no: form.truck_seal_no.trim() || null,
        chick_van_temp_c: clampNonNegStringToNumberOrNull(
          form.chick_van_temp_c,
        ),
        number_of_fans: clampNonNegStringToNumberOrNull(form.number_of_fans),
        remarks: form.remarks.trim() || null,
        items,
      };

      let savedId = editId;
      if (isEdit && editId) {
        await updateDispatchDoc(editId, payload);
      } else {
        savedId = await createDispatchDoc(payload);
      }
      draftSaved = true;

      if (post && savedId) await postDispatchDoc(savedId);

      alert(post ? "DOC Dispatch posted successfully." : isEdit ? "Draft updated successfully." : "Draft saved successfully.");

      router.push("/jmb/docdispatchv2");
      router.refresh();
    } catch (e) {
      console.error(e);
      alert(post && draftSaved
        ? "The draft was saved, but posting failed. No notification was created. Open the draft and try posting again."
        : "Failed to save. Please check console for error.");
      if (post && draftSaved) router.push("/jmb/docdispatchv2");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full  px-6 py-6  mt-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        FirstPreviewsPageName="DOC Dispatch"
        CurrentPageName={isEdit ? "Edit Delivery Receipt" : "Delivery Receipt"}
      />

      <Card className="w-full  min-h-[calc(90vh-120px)] p-6 space-y-4 mt-2">
        <CardContent className="max-w-4xl p-4 space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                {/* Left */}

                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>Delivery Receipt No.</Label>
                    <Input
                      value={form.dr_no}
                      onChange={(e) => {
                        drManualRef.current = true;
                        setField("dr_no", e.target.value);
                      }}
                      placeholder="DR-MMDDYY-0001"
                      disabled
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={form.doc_date}
                      onChange={(e) => {
                        setField("doc_date", e.target.value);
                      }}
                      disabled={saving || readOnly}
                    />
                  </div>

                  <div className="space-y-1 max-w-xl">
                    <RequiredLabel>Destination Farm</RequiredLabel>
                    <SearchableDropdown
                      list={boilerFarms}
                      codeLabel="code"
                      nameLabel="name"
                      showNameOnly
                      value={form.destination_farm_code}
                      onChange={(val, item) => handleFarmChange(val, item)}
                      disabled={saving || readOnly || boilerFarmsLoading}
                    />
                    {/* <Select
                      value={form.farm_name}
                      onValueChange={handleFarmChange}
                      disabled={saving || boilerFarmsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            boilerFarmsLoading
                              ? "Loading farms..."
                              : "Select farm..."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {boilerFarms.map((farm) => (
                          <SelectItem
                            key={farm.boiler_name}
                            value={farm.boiler_name}
                          >
                            {farm.boiler_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select> */}
                  </div>

                  <div className="space-y-1">
                    <Label>Address</Label>
                    <Textarea value={form.address} placeholder="" disabled />
                  </div>

                  <div className="space-y-1">
                    <Label>Hauler Plate Number</Label>
                    <Input
                      value={form.hauler_plate_no}
                      onChange={(e) =>
                        setField("hauler_plate_no", e.target.value)
                      }
                      disabled={saving || readOnly}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Chick Van Temp</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.chick_van_temp_c}
                      onChange={(e) =>
                        setField("chick_van_temp_c", e.target.value)
                      }
                      onBlur={(e) =>
                        setField(
                          "chick_van_temp_c",
                          clampNonNegString(e.target.value),
                        )
                      }
                      placeholder="°C"
                      disabled={saving || readOnly}
                    />
                  </div>
                </div>

                {/* Right */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label>Hauler Name</Label>
                    <Input
                      value={form.hauler_name}
                      onChange={(e) => setField("hauler_name", e.target.value)}
                      disabled={saving || readOnly}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Truck Seal Number</Label>
                    <Input
                      value={form.truck_seal_no}
                      onChange={(e) =>
                        setField("truck_seal_no", e.target.value)
                      }
                      placeholder=""
                      disabled={saving || readOnly}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Number of Fans</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.number_of_fans}
                      onChange={(e) =>
                        setField("number_of_fans", e.target.value)
                      }
                      onBlur={(e) =>
                        setField(
                          "number_of_fans",
                          clampNonNegString(e.target.value),
                        )
                      }
                      placeholder=""
                      disabled={saving || readOnly}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Item entry */}
              <div className="space-y-6">
                {/* Row 1: DOC Batch Code */}
                <div className="space-y-1 max-w-xl">
                  <Label>DOC Batch Code</Label>
                  <Select
                    value={itemDraft.doc_batch_code}
                    onValueChange={async (v) => {
                      setDraft("doc_batch_code", v);

                      // if SKU already selected, refresh qty
                      if (itemDraft.sku_name) {
                        try {
                          const row = await ensureGradingRow(v);
                          if (!row) return;
                          const field = SKU_TO_FIELD[itemDraft.sku_name];
                          if (!field) return;
                          const qtyStr = String(
                            Math.max(0, Number(row[field] ?? 0)),
                          );
                          setItemDraft((p) => ({ ...p, qty: qtyStr }));
                        } catch (e) {
                          console.error(e);
                        }
                      }
                    }}
                    disabled={docBatchLoading || saving}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          docBatchLoading ? "Loading..." : "Select batch code"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {docBatchCodes.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Row 2: SKU Name | SKU Classification | UoM | Qty */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                  {/* SKU Name */}
                  <div className="space-y-1 md:col-span-4">
                    <Label>SKU Name</Label>
                    <Select
                      value={itemDraft.sku_name}
                      onValueChange={handleSkuChange}
                      disabled={saving || readOnly}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select SKU name" />
                      </SelectTrigger>
                      <SelectContent>
                        {SKU_OPTIONS.map((s) => (
                          <SelectItem key={s.sku_name} value={s.sku_name}>
                            {s.sku_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* SKU Classification (disabled input) */}
                  <div className="space-y-1 md:col-span-4">
                    <Label>SKU Classification</Label>
                    <Input
                      value={labelClassification(itemDraft.classification)}
                      placeholder="Auto"
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  {/* UoM */}
                  <div className="space-y-1 md:col-span-2">
                    <Label>UoM</Label>
                    <Select
                      value={itemDraft.uom}
                      onValueChange={(v) => setDraft("uom", v as UomType)}
                      disabled={saving || readOnly}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select UoM" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PCS">PCS</SelectItem>
                        <SelectItem value="TRAY">TRAY</SelectItem>
                        <SelectItem value="BOX">BOX</SelectItem>
                        <SelectItem value="CRATE">CRATE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Qty */}
                  <div className="space-y-1 md:col-span-2">
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min={0}
                      value={itemDraft.qty}
                      onChange={(e) => setDraft("qty", e.target.value)}
                      onBlur={(e) =>
                        setDraft("qty", clampNonNegString(e.target.value))
                      }
                      disabled={saving || readOnly}
                    />
                  </div>
                </div>

                {/* Button (optional: align under right side like typical forms) */}
                <div className="flex justify-start md:justify-end ">
                  <Button
                    className="w-full md:w-auto h-full md:h-auto"
                    type="button"
                    onClick={addItem}
                    disabled={saving || readOnly}
                  >
                    Add item
                  </Button>
                </div>
              </div>
              {/* Items table */}
              <div className="space-y-3">
                <div className="border rounded-lg overflow-hidden bg-background">
                  {/* Header */}
                  <div className="grid grid-cols-12 bg-muted/60 px-5 py-3 text-sm font-medium">
                    <div className="col-span-2">Action</div>
                    <div className="col-span-5">Doc Batch Code</div>
                    <div className="col-span-2">SKU</div>
                    <div className="col-span-2">Classification</div>
                    <div className="col-span-1 text-right">Qty</div>
                  </div>

                  {/* Body */}
                  {items.length === 0 ? (
                    <div className="px-5 py-10 text-sm text-muted-foreground">
                      No items added.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {items.map((it, idx) => (
                        <div
                          key={`${it.doc_batch_code}-${idx}`}
                          className="grid grid-cols-12 px-5 py-3 text-sm items-center"
                        >
                          <div className="col-span-2">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Remove"
                              onClick={() => removeItem(idx)}
                              disabled={saving || readOnly}
                              className="
                            text-red-500 
                            hover:bg-red-100 
                            hover:text-red-600
                            border
                            border-red-200
                            rounded-md
                          "
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>

                          <div
                            className="col-span-5 truncate"
                            title={it.doc_batch_code}
                          >
                            {it.doc_batch_code}
                          </div>

                          <div
                            className="col-span-2 truncate"
                            title={it.sku_name}
                          >
                            {it.sku_name}
                          </div>

                          <div className="col-span-2">
                            {labelClassification(it.classification)}
                          </div>

                          <div className="col-span-1 text-right tabular-nums">
                            {it.qty}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total Qty bottom-right (outside table) */}
                <div className="flex justify-end text-sm text-muted-foreground">
                  Total Qty:{" "}
                  <span className="ml-1 font-medium text-foreground">
                    {totalQty}
                  </span>
                </div>
              </div>

              {/* Remarks (below table like screenshot) */}
              <div className="space-y-1">
                <Label>Remarks</Label>
                <Textarea
                  value={form.remarks}
                  onChange={(e) => setField("remarks", e.target.value)}
                  placeholder=""
                  className="min-h-30"
                  disabled={saving || readOnly}
                />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {!readOnly && (
                    <>
                      <Button type="button" variant="outline" onClick={() => void onSave(false)} disabled={saving}>
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        Save as Draft
                      </Button>
                      <Button type="button" onClick={() => void onSave(true)} disabled={saving}>
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        Post Dispatch
                      </Button>
                    </>
                  )}
                  <Button type="button" variant="outline" onClick={() => router.push("/jmb/docdispatchv2")} disabled={saving}>
                    <X className="size-4" />{readOnly ? "Close" : "Cancel"}
                  </Button>
                  <span className="ml-auto rounded-full border px-2.5 py-1 text-xs font-medium">{status}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
