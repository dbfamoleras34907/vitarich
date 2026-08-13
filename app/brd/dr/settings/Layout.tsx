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
import {
  getBrDeliverySettings,
  saveBrDeliverySettings,
  type BrDeliverySettings,
} from "./api";

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message || fallback);
  }
  return fallback;
};

export default function BrDeliverySettingsLayout() {
  const canEdit = usePermission("/brd/dr/settings/edit");
  const { getValue } = useGlobalContext();
  const session = getValue("UserInfoAuthSession");
  const rawFarmDB = getValue("getFarmDB");
  const rawUserFarms = session?.[0]?.users_farms;
  const [settings, setSettings] = useState<BrDeliverySettings | null>(null);
  const [selectedFarm, setSelectedFarm] = useState<UserFarm | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [batchAutoSelection, setBatchAutoSelection] = useState(false);
  const [targetDeliveryAge, setTargetDeliveryAge] = useState("0");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");

  const singleAllowedFarm = useMemo(() => {
    const allowedFarms = getAllowedUserFarms(
      (rawFarmDB || []) as UserFarm[],
      (rawUserFarms || []) as unknown[],
    );

    return allowedFarms.length === 1 ? allowedFarms[0] : null;
  }, [rawFarmDB, rawUserFarms]);

  const activeFarmId = selectedFarmId || (singleAllowedFarm ? String(singleAllowedFarm.id) : "");
  const activeFarm = selectedFarm ?? (activeFarmId === String(singleAllowedFarm?.id) ? singleAllowedFarm : null);
  const currentSnapshot = JSON.stringify({ farmId: activeFarmId, batchAutoSelection, targetDeliveryAge });
  const isDirty = Boolean(savedSnapshot) && currentSnapshot !== savedSnapshot;

  const canSave = useMemo(
    () => !saving && !loading && !canEdit && Boolean(activeFarmId),
    [activeFarmId, canEdit, loading, saving],
  );

  const resetSettingsForm = useCallback(() => {
    setSettings(null);
    setBatchAutoSelection(false);
    setTargetDeliveryAge("0");
    setSavedSnapshot("");
  }, []);

  const fetchSettings = useCallback(async () => {
    const farmId = Number(activeFarmId);
    if (!Number.isFinite(farmId) || farmId <= 0) {
      resetSettingsForm();
      return;
    }

    setLoading(true);
    try {
      const nextSettings = await getBrDeliverySettings(farmId);
      setSettings(nextSettings);
      setBatchAutoSelection(Boolean(nextSettings?.batch_auto_selection));
      setTargetDeliveryAge(String(nextSettings?.target_delivery_age ?? 0));
      setSavedSnapshot(JSON.stringify({
        farmId: activeFarmId,
        batchAutoSelection: Boolean(nextSettings?.batch_auto_selection),
        targetDeliveryAge: String(nextSettings?.target_delivery_age ?? 0),
      }));
    } catch (error) {
      toast("Error: " + errorMessage(error, "Unable to load BR Delivery settings"));
      resetSettingsForm();
    } finally {
      setLoading(false);
    }
  }, [activeFarmId, resetSettingsForm]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  const handleRefresh = () => {
    if (isDirty && !window.confirm("Discard unsaved settings?")) return;
    void fetchSettings();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!activeFarmId) {
      toast("Please select a farm.");
      return;
    }

    if (!canSave) {
      toast("You do not have permission to edit this setting.");
      return;
    }

    const parsedTargetDeliveryAge = Number(targetDeliveryAge);
    if (!Number.isInteger(parsedTargetDeliveryAge) || parsedTargetDeliveryAge < 0) {
      toast("Target Delivery Age must be a whole number of days, zero or greater.");
      return;
    }

    setSaving(true);
    try {
      const saved = await saveBrDeliverySettings({
        id: settings?.id,
        farm_id: Number(activeFarmId),
        farm_code: activeFarm?.code ?? settings?.farm_code ?? null,
        farm_name: activeFarm?.name ?? settings?.farm_name ?? null,
        batch_auto_selection: batchAutoSelection,
        target_delivery_age: parsedTargetDeliveryAge,
      });
      setSettings(saved);
      setBatchAutoSelection(Boolean(saved.batch_auto_selection));
      setTargetDeliveryAge(String(saved.target_delivery_age));
      setSavedSnapshot(JSON.stringify({
        farmId: activeFarmId,
        batchAutoSelection: Boolean(saved.batch_auto_selection),
        targetDeliveryAge: String(saved.target_delivery_age),
      }));
      toast("Harvest & Delivery settings saved");
    } catch (error) {
      toast("Error: " + errorMessage(error, "Unable to save BR Delivery settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-3 p-3 sm:p-4">
      <div>
        <Breadcrumb
          FirstPreviewsPageName="Settings"
          CurrentPageName="Harvest & Delivery Settings"
        />
      </div>

      <ModuleSettingsHeader
        title="Harvest & Delivery Settings"
        description="Configure Harvest & Delivery defaults and operational behavior."
        formId="harvest-delivery-settings-form"
        loading={loading}
        saving={saving}
        disableRefresh={!activeFarmId}
        disableSave={!canSave}
        onRefresh={handleRefresh}
      />

      <form id="harvest-delivery-settings-form" onSubmit={handleSubmit} className="space-y-3">
        <SettingsCategory title="Scope" description="Select the farm whose harvest and delivery rules you want to maintain.">
          <SettingRow label="Farm" description="Settings are stored independently for each authorized farm." settingKey="FARM_ID" required>
                <UserFarmSearchCombobox
                  label="Farm"
                  required
                  value={activeFarmId}
                  onValueChange={(farmId, farm) => {
                    if (farmId !== activeFarmId && isDirty && !window.confirm("Discard unsaved settings?")) return;
                    setSelectedFarmId(farmId);
                    setSelectedFarm(farm ?? null);
                  }}
                />
          </SettingRow>
        </SettingsCategory>

        <SettingsCategory title="Harvest Validation" description="Define when a flock becomes eligible for harvest and delivery.">
          <SettingRow label="Target Delivery Age" description="Minimum DOC age in days required before a Harvest & Delivery document can be posted." settingKey="TARGET_DELIVERY_AGE" required>
                  <Input
                    id="target-delivery-age"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={targetDeliveryAge}
                    disabled={loading || saving || canEdit || !activeFarmId}
                    onChange={(event) => setTargetDeliveryAge(event.target.value)}
                  />
          </SettingRow>
        </SettingsCategory>

        <SettingsCategory title="Batch Selection" description="Control how available placement batches are presented during delivery.">
          <SettingRow label="Batch auto selection" description="Selects the batch automatically when one is available and opens batch selection when multiple batches are available." settingKey="BATCH_AUTO_SELECTION">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="batch-auto-selection"
                      checked={batchAutoSelection}
                      disabled={loading || saving || canEdit || !activeFarmId}
                      onCheckedChange={(checked) => setBatchAutoSelection(checked === true)}
                    />
                    <Label htmlFor="batch-auto-selection">{batchAutoSelection ? "Enabled" : "Disabled"}</Label>
                  </div>
          </SettingRow>
        </SettingsCategory>
      </form>
    </main>
  );
}
