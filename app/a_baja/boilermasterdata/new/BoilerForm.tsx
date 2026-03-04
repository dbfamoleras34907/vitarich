"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Breadcrumb from "@/lib/Breadcrumb";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  createBoilerMasterdata,
  deleteBoilerMasterdata,
  getBoilerMasterdataById,
  updateBoilerMasterdata,
  type BoilerMasterdataInsert,
} from "./api";
import FormActionButtons from "@/components/FormActionButtons";
import RequiredLabel from "@/components/RequiredLabel";

type FormState = {
  boiler_name: string;
  assigned_ta: string;
  region: string;
  address: string;
};

const Required = () => <span className="text-red-500"> *</span>;

export default function BoilerForm() {
  const router = useRouter();
  const search = useSearchParams();
  const idParam = search.get("id");
  const isEdit = useMemo(() => !!idParam, [idParam]);
  const editId = useMemo(() => (idParam ? Number(idParam) : null), [idParam]);

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  const [notice, setNotice] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const [form, setForm] = useState<FormState>({
    boiler_name: "",
    assigned_ta: "",
    region: "",
    address: "",
  });

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    const name = form.boiler_name.trim();
    if (!name) return "Boiler name is required.";
    // If you want these required too, keep them required:
    const region = form.region.trim();
    const address = form.address.trim();
    if (!region) return "Region is required.";
    if (!address) return "Address is required.";
    return null;
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!isEdit || !editId) return;
      setLoading(true);
      setNotice(null);
      try {
        const row = await getBoilerMasterdataById(editId);
        if (!mounted) return;
        setForm({
          boiler_name: row.boiler_name ?? "",
          assigned_ta: row.assigned_ta ?? "",
          region: row.region ?? "",
          address: row.address ?? "",
        });
      } catch (e: any) {
        console.error(e);
        setNotice({
          type: "error",
          msg: e?.message ?? "Failed to load record.",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [isEdit, editId]);

  async function onSave() {
    setNotice(null);
    const err = validate();
    if (err) {
      setNotice({ type: "error", msg: err });
      return;
    }

    const payload: BoilerMasterdataInsert = {
      boiler_name: form.boiler_name.trim(),
      assigned_ta: form.assigned_ta.trim() || null,
      region: form.region.trim() || null,
      address: form.address.trim() || null,
      is_active: true,
    };

    setSaving(true);
    try {
      if (isEdit && editId) {
        await updateBoilerMasterdata(editId, payload);
        setNotice({ type: "success", msg: "Record updated successfully." });
      } else {
        await createBoilerMasterdata(payload);
        setNotice({ type: "success", msg: "Record saved successfully." });
        setForm({ boiler_name: "", assigned_ta: "", region: "", address: "" });
      }
    } catch (e: any) {
      console.error(e);
      setNotice({ type: "error", msg: e?.message ?? "Failed to save record." });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!isEdit || !editId) return;
    setNotice(null);
    setDeleting(true);
    try {
      await deleteBoilerMasterdata(editId);
      setNotice({
        type: "success",
        msg: "Record deleted (inactive) successfully.",
      });
      router.push("/a_baja/boilermasterdata");
      router.refresh();
    } catch (e: any) {
      console.error(e);
      setNotice({
        type: "error",
        msg: e?.message ?? "Failed to delete record.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="w-full  px-6 py-6  mt-4">
      <Breadcrumb
        FirstPreviewsPageName="Master Data"
        SecondPreviewPageName="Boiler"
        CurrentPageName={isEdit ? "Edit Record" : "New Record"}
      />

      <Card className="w-full  min-h-[calc(90vh-120px)] p-6 space-y-4 mt-2">
        <CardContent className="max-w-2xl p-4 space-y-4">
          {notice && (
            <Alert
              variant={notice.type === "error" ? "destructive" : "default"}
            >
              <AlertTitle>
                {notice.type === "error" ? "Error" : "Success"}
              </AlertTitle>
              <AlertDescription>{notice.msg}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                {/* Boiler Name */}
                <div className="space-y-1">
                  <RequiredLabel>Boiler Name</RequiredLabel>

                  <Input
                    value={form.boiler_name}
                    onChange={(e) => setField("boiler_name", e.target.value)}
                    placeholder="e.g. ABEL-CAST Poultry Farm"
                    disabled={saving || deleting}
                  />
                </div>

                {/* Assigned TA */}
                <div className="space-y-1">
                  <RequiredLabel>Assigned TA</RequiredLabel>
                  <Input
                    value={form.assigned_ta}
                    onChange={(e) => setField("assigned_ta", e.target.value)}
                    placeholder="e.g. Jaymar Sanchez"
                    disabled={saving || deleting}
                  />
                </div>

                {/* Region */}
                <div className="space-y-1">
                  <RequiredLabel>Region</RequiredLabel>
                  <Input
                    value={form.region}
                    onChange={(e) => setField("region", e.target.value)}
                    placeholder="e.g. Davao"
                    disabled={saving || deleting}
                  />
                </div>

                {/* Address */}
                <div className="space-y-1">
                  <RequiredLabel>Complete Address</RequiredLabel>
                  <Input
                    value={form.address}
                    onChange={(e) => setField("address", e.target.value)}
                    placeholder="e.g. Davao"
                    disabled={saving || deleting}
                  />
                </div>
              </div>

              <Separator />

              {/* <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  onClick={() => router.push("/a_baja/boilermasterdata")}
                  disabled={saving || deleting}
                >
                  Cancel
                </Button>

                {isEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border border-red-200 text-red-700 hover:bg-red-50"
                    onClick={onDelete}
                    disabled={saving || deleting}
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={onSave}
                  disabled={saving || deleting}
                >
                  {saving ? "Saving..." : isEdit ? "Update" : "Save"}
                </Button>
              </div> */}

              {/* Actions */}
              <FormActionButtons
                saving={saving}
                isEdit={isEdit}
                // disabled={disabledAll}
                cancelPath="/a_baja/boilermasterdata"
                onSave={onSave}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
