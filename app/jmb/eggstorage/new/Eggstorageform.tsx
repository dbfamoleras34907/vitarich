/**
 * Egg Storage Form Component
 *
 * A comprehensive form for creating and editing egg storage records in the hatchery management system.
 * Handles temperature, humidity, and shell temperature monitoring data for stored eggs.
 *
 * @component
 * @returns {JSX.Element} The rendered egg storage form with validation and duration calculation
 *
 * @example
 * ```tsx
 * <Eggstorageform />
 * ```
 *
 * @remarks
 * - Supports both create (new record) and update (edit existing) modes
 * - Automatically calculates storage duration between shell start and end times
 * - Loads available egg reference numbers from the hatch_classification table
 * - Includes a temperature converter utility in the sidebar
 * - Requires authenticated session (checked via refreshSessionx)
 * - Uses Supabase as the backend database
 *
 * @state
 * - `loading` - Loading state for initial record fetch in edit mode
 * - `saving` - Saving state during form submission
 * - `classiRefNo` - Selected egg classification reference number
 * - `classiRefs` - Array of available egg reference options
 * - `classiRefLoading` - Loading state for reference dropdown
 * - `stor_temp` - Storage temperature in Celsius
 * - `room_temp` - Room temperature in Celsius
 * - `stor_humi` - Storage humidity percentage
 * - `shellStartLocal` - Shell temperature measurement start datetime (local format)
 * - `shellEndLocal` - Shell temperature measurement end datetime (local format)
 * - `remarks` - Additional notes about the storage record
 *
 * @effects
 * - Loads classification references on component mount
 * - Validates user session on mount
 * - Loads existing record data in edit mode based on URL parameter
 * - Calculates duration whenever shell timestamps change
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import Breadcrumb from "@/lib/Breadcrumb";
import { db } from "@/lib/Supabase/supabaseClient";
import {
  createEggStorage,
  getEggStorageById,
  updateEggStorage,
  type EggStorageInsert,
} from "./api";
import FormActionButtons from "@/components/FormActionButtons";
import RequiredLabel from "@/components/RequiredLabel";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import SearchableDropdown from "@/lib/SearchableDropdown";
import TemperatureConverter from "@/components/TemperatureConverter";
import SearchableDropdown1 from "@/lib/SearchableDropdown1";

type HatchClassiRefOption = {
  classi_ref_no: string;
  date_classify: string | null;
};

function toDatetimeLocalValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return d.toISOString();
}

export default function Eggstorageform() {
  const router = useRouter();
  const sp = useSearchParams();
  const idParam = sp.get("id");
  const editId = idParam ? Number(idParam) : null;
  const isEdit = Number.isFinite(editId) && (editId as number) > 0;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // dropdown
  const [classiRefNos, setClassiRefNos] = useState<string[]>([]);
  const [classiRefs, setClassiRefs] = useState<HatchClassiRefOption[]>([]);
  const [classiRefLoading, setClassiRefLoading] = useState(false);

  const [stor_temp, setStorTemp] = useState("");
  const [room_temp, setRoomTemp] = useState("");
  const [stor_humi, setStorHumi] = useState("");
  const [shellStartLocal, setShellStartLocal] = useState("");
  const [shellEndLocal, setShellEndLocal] = useState("");
  const [remarks, setRemarks] = useState("");
  const [selectedEggRefs, setSelectedEggRefs] = useState<string[]>([]);
  // load ref options
  useEffect(() => {
    const loadClassiRefs = async () => {
      try {
        setClassiRefLoading(true);
        const { data, error } = await db
          .from("view_eggclassi_for_eggstorage")
          .select("classi_ref_no,date_classify")
          .order("date_classify", { ascending: false })
          .order("classi_ref_no", { ascending: false });

        if (error) throw error;
        setClassiRefs((data ?? []) as HatchClassiRefOption[]);
      } catch (e) {
        console.error(e);
        setClassiRefs([]);
      } finally {
        setClassiRefLoading(false);
      }
    };
    loadClassiRefs();
  }, []);

  useEffect(() => {
    refreshSessionx(router);
  }, []);
  // load record if edit
  useEffect(() => {
    if (!isEdit) return;

    const loadRecord = async () => {
      try {
        setLoading(true);
        const data = await getEggStorageById(editId as number);

        setClassiRefNos(data.classi_ref_no ? [data.classi_ref_no] : []);
        setStorTemp(data.stor_temp ?? "");
        setRoomTemp(data.room_temp ?? "");
        setStorHumi(data.stor_humi ?? "");
        setShellStartLocal(toDatetimeLocalValue(data.shell_start));
        setShellEndLocal(toDatetimeLocalValue(data.shell_end));
        setRemarks(data.remarks ?? "");
      } catch (e) {
        console.error(e);
        alert("Failed to load record.");
        router.push("/jmb/eggstorage");
      } finally {
        setLoading(false);
      }
    };

    loadRecord();
  }, [isEdit, editId, router]);

  const durationSeconds = useMemo(() => {
    if (!shellStartLocal || !shellEndLocal) return null;
    const s = new Date(shellStartLocal).getTime();
    const e = new Date(shellEndLocal).getTime();
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
    return Math.floor((e - s) / 1000);
  }, [shellStartLocal, shellEndLocal]);

  const durationDisplay = useMemo(() => {
    if (durationSeconds == null) return "";
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    if (hours <= 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  }, [durationSeconds]);

  // async function onSave() {
  //   try {
  //     setSaving(true);

  //     const payload: EggStorageInsert = {
  //       stor_temp: stor_temp || null,
  //       room_temp: room_temp || null,
  //       stor_humi: stor_humi || null,
  //       shell_start: fromDatetimeLocalValue(shellStartLocal),
  //       shell_end: fromDatetimeLocalValue(shellEndLocal),
  //       duration: durationSeconds,
  //       remarks: remarks || null,
  //       classi_ref_no: classiRefNo || null,
  //     };

  //     if (isEdit) {
  //       await updateEggStorage(editId as number, payload); // ✅ 2 args
  //     } else {
  //       await createEggStorage(payload);
  //     }

  //     router.push("/jmb/eggstorage");
  //     router.refresh();
  //   } catch (err: any) {
  //     alert(err?.message ?? "Failed to save.");
  //   } finally {
  //     setSaving(false);
  //   }
  // }

  async function onSave() {
    try {
      setSaving(true);

      if (classiRefNos.length === 0) {
        alert("Please select at least one Egg Reference No.");
        return;
      }

      const basePayload = {
        stor_temp: stor_temp || null,
        room_temp: room_temp || null,
        stor_humi: stor_humi || null,
        shell_start: fromDatetimeLocalValue(shellStartLocal),
        shell_end: fromDatetimeLocalValue(shellEndLocal),
        duration: durationSeconds,
        remarks: remarks || null,
      };

      if (isEdit) {
        // ⚠️ Usually edit = single record only
        await updateEggStorage(editId as number, {
          ...basePayload,
          classi_ref_no: classiRefNos[0] ?? null,
        });
      } else {
        // ✅ Insert multiple rows
        const payloads: EggStorageInsert[] = classiRefNos.map((ref) => ({
          ...basePayload,
          classi_ref_no: ref,
        }));

        await createEggStorage(payloads); // ← must support bulk insert
      }

      router.push("/jmb/eggstorage");
      router.refresh();
    } catch (err: any) {
      alert(err?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full  px-6 py-6  mt-4">
      <Breadcrumb
        FirstPreviewsPageName="Egg Storage Management"
        SecondPreviewPageName="Hatchery "
        CurrentPageName={isEdit ? "Edit Record" : "New Record"}
      />
      <Card className="w-full  min-h-[calc(90vh-120px)] p-6 space-y-4 mt-2">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CardContent className="max-w-2xl p-4 space-y-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                <>
                  {/* Reference No. */}
                  <div className="grid grid-cols-1 gap-2">
                    <RequiredLabel>Egg Reference No.</RequiredLabel>
                    <SearchableDropdown1
                      list={classiRefs}
                      codeLabel="classi_ref_no"
                      nameLabel="classi_ref_no"
                      showNameOnly
                      value={classiRefNos}
                      onChange={(val) => setClassiRefNos(val)}
                      multiple
                      disabled={saving || classiRefLoading}
                    />
                    {/* <Select value={classiRefNo} onValueChange={setClassiRefNo}>
                  <SelectTrigger disabled={classiRefLoading || saving}>
                    <SelectValue
                      placeholder={
                        classiRefLoading
                          ? "Loading..."
                          : "Select Egg Reference No."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {classiRefs.map((r) => (
                      <SelectItem key={r.classi_ref_no} value={r.classi_ref_no}>
                        {r.classi_ref_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select> */}
                  </div>
                  <Separator />
                  {/* TEMPS / HUMI */}
                  <div className="grid grid-cols-1 md:grid-cols-1 gap-2">
                    <div className="grid grid-cols-1 gap-2">
                      <RequiredLabel>Storage Temperature ℃</RequiredLabel>
                      <Input
                        value={stor_temp}
                        onChange={(e) => setStorTemp(e.target.value)}
                        disabled={saving}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <RequiredLabel>Room Temperature ℃</RequiredLabel>
                      <Input
                        value={room_temp}
                        onChange={(e) => setRoomTemp(e.target.value)}
                        disabled={saving}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <RequiredLabel>Storage Humidity %</RequiredLabel>
                      <Input
                        value={stor_humi}
                        onChange={(e) => setStorHumi(e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  {/* SHELL TEMP TIMESTAMPS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="grid grid-cols-1 gap-2">
                      <Label>Shell Temp DateTime Start</Label>
                      <Input
                        type="datetime-local"
                        value={shellStartLocal}
                        onChange={(e) => setShellStartLocal(e.target.value)}
                        disabled={saving}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <Label>Shell Temp DateTime End</Label>
                      <Input
                        type="datetime-local"
                        value={shellEndLocal}
                        onChange={(e) => setShellEndLocal(e.target.value)}
                        disabled={saving}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <Label>Duration</Label>
                      <Input disabled value={durationDisplay} />
                      {shellStartLocal &&
                        shellEndLocal &&
                        durationSeconds == null && (
                          <p className="text-sm text-destructive mt-1">
                            End must be greater than Start.
                          </p>
                        )}
                    </div>
                  </div>

                  {/* REMARKS */}
                  <div className="grid grid-cols-1 gap-2">
                    <Label>Remarks</Label>
                    <Textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="min-h-30"
                      disabled={saving}
                    />
                  </div>

                  {/* ACTIONS */}
                  <FormActionButtons
                    saving={saving}
                    isEdit={isEdit}
                    // disabled={disabledAll}
                    cancelPath="/jmb/eggstorage"
                    onSave={onSave}
                  />
                </>
              )}
            </CardContent>
          </div>
          <div className="lg:col-span-1">
            <TemperatureConverter
              title="Temperature"
              defaultFromUnit="C"
              defaultValue={0}
              showApplyButton
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
