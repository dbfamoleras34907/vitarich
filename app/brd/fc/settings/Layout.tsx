"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import UserFarmSearchCombobox, { getAllowedUserFarms, type UserFarm } from "@/components/ui/UserFarmSearchCombobox";
import Breadcrumb from "@/lib/Breadcrumb";
import { usePermission } from "@/hooks/usePermission";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { ModuleSettingsHeader, SettingRow, SettingsCategory } from "@/components/settings/ModuleSettingsLayout";
import {
  getFlockCardSettings,
  saveFlockCardSettings,
  type AutoFeedBatchSelectionMode,
  type FlockCardSettings,
} from "./api";

const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message || fallback);
  }
  return fallback;
};

export default function FlockCardSettingsLayout() {
  const canEdit = usePermission("/brd/fc/settings/edit");
  const { getValue, setValue } = useGlobalContext();
  const session = getValue("UserInfoAuthSession");
  const rawFarmDB = getValue("getFarmDB");
  const rawUserFarms = session?.[0]?.users_farms;
  const [settings, setSettings] = useState<FlockCardSettings | null>(null);
  const [selectedFarm, setSelectedFarm] = useState<UserFarm | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [allowAdvancePosting, setAllowAdvancePosting] = useState(false);
  const [autoFeedBatchSelection, setAutoFeedBatchSelection] = useState(false);
  const [autoFeedBatchSelectionMode, setAutoFeedBatchSelectionMode] =
    useState<AutoFeedBatchSelectionMode>("USER_SELECTED");
  const [autoMortalityRateBatchSelection, setAutoMortalityRateBatchSelection] = useState(false);
  const [loading, setLoading] = useState(true);
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
  const currentSnapshot = JSON.stringify({
    farmId: activeFarmId,
    allowAdvancePosting,
    autoFeedBatchSelection,
    autoFeedBatchSelectionMode,
    autoMortalityRateBatchSelection,
  });
  const isDirty = Boolean(savedSnapshot) && currentSnapshot !== savedSnapshot;

  const canSave = useMemo(
    () => !saving && !loading && !canEdit && Boolean(activeFarmId),
    [activeFarmId, canEdit, loading, saving],
  );

  const fetchSettings = useCallback(async () => {
    const farmId = Number(activeFarmId);
    if (!Number.isFinite(farmId) || farmId <= 0) {
      setSettings(null);
      setAllowAdvancePosting(false);
      setAutoFeedBatchSelection(false);
      setAutoFeedBatchSelectionMode("USER_SELECTED");
      setAutoMortalityRateBatchSelection(false);
      setSavedSnapshot("");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const nextSettings = await getFlockCardSettings(farmId);
      setSettings(nextSettings);
      setValue("FlockCardSettings", nextSettings);
      setAllowAdvancePosting(Boolean(nextSettings?.allow_advance_posting));
      setAutoFeedBatchSelection(Boolean(nextSettings?.auto_feed_batch_selection));
      setAutoFeedBatchSelectionMode(nextSettings?.auto_feed_batch_selection_mode ?? "USER_SELECTED");
      setAutoMortalityRateBatchSelection(Boolean(nextSettings?.auto_mortality_rate_batch_selection));
      setSavedSnapshot(JSON.stringify({
        farmId: activeFarmId,
        allowAdvancePosting: Boolean(nextSettings?.allow_advance_posting),
        autoFeedBatchSelection: Boolean(nextSettings?.auto_feed_batch_selection),
        autoFeedBatchSelectionMode: nextSettings?.auto_feed_batch_selection_mode ?? "USER_SELECTED",
        autoMortalityRateBatchSelection: Boolean(nextSettings?.auto_mortality_rate_batch_selection),
      }));
    } catch (error) {
      toast("Error: " + errorMessage(error, "Unable to load Flock Card settings"));
      setSettings(null);
      setAllowAdvancePosting(false);
      setAutoFeedBatchSelection(false);
      setAutoFeedBatchSelectionMode("USER_SELECTED");
      setAutoMortalityRateBatchSelection(false);
      setSavedSnapshot("");
    } finally {
      setLoading(false);
    }
  }, [activeFarmId, setValue]);

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

    setSaving(true);
    try {
      const saved = await saveFlockCardSettings({
        id: settings?.id,
        farm_id: Number(activeFarmId),
        farm_code: activeFarm?.code ?? settings?.farm_code ?? null,
        farm_name: activeFarm?.name ?? settings?.farm_name ?? null,
        allow_advance_posting: allowAdvancePosting,
        auto_feed_batch_selection: autoFeedBatchSelection,
        auto_feed_batch_selection_mode: autoFeedBatchSelectionMode,
        auto_mortality_rate_batch_selection: autoMortalityRateBatchSelection,
      });
      setSettings(saved);
      setValue("FlockCardSettings", saved);
      setAllowAdvancePosting(Boolean(saved.allow_advance_posting));
      setAutoFeedBatchSelection(Boolean(saved.auto_feed_batch_selection));
      setAutoFeedBatchSelectionMode(saved.auto_feed_batch_selection_mode ?? "USER_SELECTED");
      setAutoMortalityRateBatchSelection(Boolean(saved.auto_mortality_rate_batch_selection));
      setSavedSnapshot(JSON.stringify({
        farmId: activeFarmId,
        allowAdvancePosting: Boolean(saved.allow_advance_posting),
        autoFeedBatchSelection: Boolean(saved.auto_feed_batch_selection),
        autoFeedBatchSelectionMode: saved.auto_feed_batch_selection_mode ?? "USER_SELECTED",
        autoMortalityRateBatchSelection: Boolean(saved.auto_mortality_rate_batch_selection),
      }));
      toast("Growing & Farm Condition settings saved");
    } catch (error) {
      toast("Error: " + errorMessage(error, "Unable to save Flock Card settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-3 p-3 sm:p-4">
      <div>
        <Breadcrumb
          FirstPreviewsPageName="Settings"
          CurrentPageName="Growing & Farm Condition Settings"
        />
      </div>

      <ModuleSettingsHeader
        title="Growing & Farm Condition Settings"
        description="Configure Growing & Farm Condition defaults and operational behavior."
        formId="growing-farm-condition-settings-form"
        loading={loading}
        saving={saving}
        disableRefresh={!activeFarmId}
        disableSave={!canSave}
        onRefresh={handleRefresh}
      />

      <form id="growing-farm-condition-settings-form" onSubmit={handleSubmit} className="space-y-3">
        <SettingsCategory title="Scope" description="Select the farm whose operational settings you want to maintain.">
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

        <SettingsCategory title="Posting & Inventory" description="Control posting dates and automatic inventory allocation behavior.">
          <SettingRow label="Allow advance posting" description="Allows users to post rows ahead of the current flock age." settingKey="ALLOW_ADVANCE_POSTING">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="allow-advance-posting"
                      checked={allowAdvancePosting}
                      disabled={loading || saving || canEdit || !activeFarmId}
                      onCheckedChange={(checked) => setAllowAdvancePosting(checked === true)}
                    />
                    <Label htmlFor="allow-advance-posting">{allowAdvancePosting ? "Enabled" : "Disabled"}</Label>
                  </div>
          </SettingRow>

          <SettingRow label="Auto mortality rate batch selection" description="Prorates whole-bird mortality across placement batches without decimal quantities." settingKey="AUTO_MORTALITY_RATE_BATCH_SELECTION">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="auto-mortality-rate-batch-selection"
                      checked={autoMortalityRateBatchSelection}
                      disabled={loading || saving || canEdit || !activeFarmId}
                      onCheckedChange={(checked) => setAutoMortalityRateBatchSelection(checked === true)}
                    />
                    <Label htmlFor="auto-mortality-rate-batch-selection">{autoMortalityRateBatchSelection ? "Enabled" : "Disabled"}</Label>
                  </div>
          </SettingRow>

          <SettingRow label="Auto feed batch selection" description="Shows available feed batches automatically when users open a new Growing & Farm Condition record." settingKey="AUTO_FEED_BATCH_SELECTION">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="auto-feed-batch-selection"
                      checked={autoFeedBatchSelection}
                      disabled={loading || saving || canEdit || !activeFarmId}
                      onCheckedChange={(checked) => setAutoFeedBatchSelection(checked === true)}
                    />
                    <Label htmlFor="auto-feed-batch-selection">{autoFeedBatchSelection ? "Enabled" : "Disabled"}</Label>
                  </div>

                  <RadioGroup
                    value={autoFeedBatchSelectionMode}
                    onValueChange={(value) => setAutoFeedBatchSelectionMode(value as AutoFeedBatchSelectionMode)}
                    className="gap-3"
                    disabled={loading || saving || canEdit || !autoFeedBatchSelection}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <RadioGroupItem id="auto-feed-batch-mode-user-selected" value="USER_SELECTED" />
                        <Label htmlFor="auto-feed-batch-mode-user-selected" className="text-sm font-medium">
                          User selects batches to consume first
                        </Label>
                      </div>
                      <p className="pl-7 text-sm leading-relaxed text-muted-foreground">
                        The user must select which feed batch or batches will be consumed first.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <RadioGroupItem id="auto-feed-batch-mode-fifo" value="FIFO" />
                        <Label htmlFor="auto-feed-batch-mode-fifo" className="text-sm font-medium">
                          Use FIFO auto selection
                        </Label>
                      </div>
                      <p className="pl-7 text-sm leading-relaxed text-muted-foreground">
                        Feed batches are automatically selected by FIFO.
                      </p>
                    </div>
                  </RadioGroup>
                </div>
          </SettingRow>
        </SettingsCategory>
      </form>
    </main>
  );
}
