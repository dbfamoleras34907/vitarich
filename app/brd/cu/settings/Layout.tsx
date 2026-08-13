"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import UserFarmSearchCombobox, { getAllowedUserFarms, type UserFarm } from "@/components/ui/UserFarmSearchCombobox";
import Breadcrumb from "@/lib/Breadcrumb";
import { usePermission } from "@/hooks/usePermission";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { ModuleSettingsHeader, SettingRow, SettingsCategory } from "@/components/settings/ModuleSettingsLayout";
import { getBrCleanupSettings, saveBrCleanupSettings, type BrCleanupSettings } from "./api";

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message || fallback);
  }
  return fallback;
};

export default function BrCleanupSettingsLayout() {
  const cannotEdit = usePermission("/brd/cu/settings/edit");
  const { getValue } = useGlobalContext();
  const session = getValue("UserInfoAuthSession");
  const rawFarmDB = getValue("getFarmDB");
  const rawUserFarms = session?.[0]?.users_farms;
  const [settings, setSettings] = useState<BrCleanupSettings | null>(null);
  const [selectedFarm, setSelectedFarm] = useState<UserFarm | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [batchAutoSelection, setBatchAutoSelection] = useState(true);
  const [targetCleanupAge, setTargetCleanupAge] = useState("0");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");

  const singleAllowedFarm = useMemo(() => {
    const farms = getAllowedUserFarms((rawFarmDB || []) as UserFarm[], (rawUserFarms || []) as unknown[]);
    return farms.length === 1 ? farms[0] : null;
  }, [rawFarmDB, rawUserFarms]);
  const activeFarmId = selectedFarmId || (singleAllowedFarm ? String(singleAllowedFarm.id) : "");
  const activeFarm = selectedFarm ?? (activeFarmId === String(singleAllowedFarm?.id) ? singleAllowedFarm : null);
  const currentSnapshot = JSON.stringify({ farmId: activeFarmId, batchAutoSelection, targetCleanupAge });
  const isDirty = Boolean(savedSnapshot) && currentSnapshot !== savedSnapshot;
  const canSave = !saving && !loading && !cannotEdit && Boolean(activeFarmId);

  const resetForm = useCallback(() => {
    setSettings(null);
    setBatchAutoSelection(true);
    setTargetCleanupAge("0");
    setSavedSnapshot("");
  }, []);

  const fetchSettings = useCallback(async () => {
    const farmId = Number(activeFarmId);
    if (!Number.isFinite(farmId) || farmId <= 0) return resetForm();
    setLoading(true);
    try {
      const next = await getBrCleanupSettings(farmId);
      const autoSelect = next?.batch_auto_selection ?? true;
      const targetAge = String(next?.target_cleanup_age ?? 0);
      setSettings(next);
      setBatchAutoSelection(autoSelect);
      setTargetCleanupAge(targetAge);
      setSavedSnapshot(JSON.stringify({ farmId: activeFarmId, batchAutoSelection: autoSelect, targetCleanupAge: targetAge }));
    } catch (error) {
      toast("Error: " + errorMessage(error, "Unable to load Clean up settings"));
      resetForm();
    } finally {
      setLoading(false);
    }
  }, [activeFarmId, resetForm]);

  useEffect(() => { void fetchSettings(); }, [fetchSettings]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (isDirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const targetAge = Number(targetCleanupAge);
    if (!Number.isInteger(targetAge) || targetAge < 0) {
      toast("Target Clean-up Age must be a whole number of days, zero or greater.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveBrCleanupSettings({
        id: settings?.id,
        farm_id: Number(activeFarmId),
        farm_code: activeFarm?.code ?? settings?.farm_code ?? null,
        farm_name: activeFarm?.name ?? settings?.farm_name ?? null,
        batch_auto_selection: batchAutoSelection,
        target_cleanup_age: targetAge,
      });
      setSettings(saved);
      setBatchAutoSelection(saved.batch_auto_selection);
      setTargetCleanupAge(String(saved.target_cleanup_age));
      setSavedSnapshot(JSON.stringify({ farmId: activeFarmId, batchAutoSelection: saved.batch_auto_selection, targetCleanupAge: String(saved.target_cleanup_age) }));
      toast("Clean up settings saved");
    } catch (error) {
      toast("Error: " + errorMessage(error, "Unable to save Clean up settings"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-3 p-3 sm:p-4">
      <Breadcrumb FirstPreviewsPageName="Settings" CurrentPageName="Clean up Settings" />
      <ModuleSettingsHeader title="Clean up Settings" description="Configure farm-specific cycle close-out rules." formId="cleanup-settings-form" loading={loading} saving={saving} disableRefresh={!activeFarmId} disableSave={!canSave} onRefresh={() => void fetchSettings()} />
      <form id="cleanup-settings-form" onSubmit={handleSubmit} className="space-y-3">
        <SettingsCategory title="Scope" description="Select the farm whose Clean up rules you want to maintain.">
          <SettingRow label="Farm" description="Settings are stored independently for each authorized farm." settingKey="FARM_ID" required>
            <UserFarmSearchCombobox label="Farm" required value={activeFarmId} onValueChange={(farmId, farm) => { setSelectedFarmId(farmId); setSelectedFarm(farm ?? null); }} />
          </SettingRow>
        </SettingsCategory>
        <SettingsCategory title="Clean-up Validation" description="Define when a building becomes eligible for cycle close-out.">
          <SettingRow label="Target Clean-up Age" description="Minimum DOC age in days required before a Clean up document can be posted." settingKey="TARGET_CLEANUP_AGE" required>
            <Input type="number" min="0" step="1" required value={targetCleanupAge} disabled={loading || saving || cannotEdit || !activeFarmId} onChange={event => setTargetCleanupAge(event.target.value)} />
          </SettingRow>
        </SettingsCategory>
        <SettingsCategory title="Batch Selection" description="Control automatic placement-batch selection during Clean up.">
          <SettingRow label="Batch auto selection" description="Automatically loads the available placement batches and defaults Clean up Quantity to the batch total. The quantity can be reduced before posting." settingKey="BATCH_AUTO_SELECTION">
            <div className="flex items-center gap-3">
              <Checkbox checked={batchAutoSelection} disabled={loading || saving || cannotEdit || !activeFarmId} onCheckedChange={checked => setBatchAutoSelection(checked === true)} />
              <Label>{batchAutoSelection ? "Enabled" : "Disabled"}</Label>
            </div>
          </SettingRow>
        </SettingsCategory>
      </form>
    </main>
  );
}
