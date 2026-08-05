"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import UserFarmSearchCombobox, { getAllowedUserFarms, type UserFarm } from "@/components/ui/UserFarmSearchCombobox";
import Breadcrumb from "@/lib/Breadcrumb";
import { usePermission } from "@/hooks/usePermission";
import { useGlobalContext } from "@/lib/context/GlobalContext";
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

  const singleAllowedFarm = useMemo(() => {
    const allowedFarms = getAllowedUserFarms(
      (rawFarmDB || []) as UserFarm[],
      (rawUserFarms || []) as unknown[],
    );
    return allowedFarms.length === 1 ? allowedFarms[0] : null;
  }, [rawFarmDB, rawUserFarms]);

  const activeFarmId = selectedFarmId || (singleAllowedFarm ? String(singleAllowedFarm.id) : "");
  const activeFarm = selectedFarm ?? (activeFarmId === String(singleAllowedFarm?.id) ? singleAllowedFarm : null);

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
    } catch (error) {
      toast("Error: " + errorMessage(error, "Unable to load Flock Card settings"));
      setSettings(null);
      setAllowAdvancePosting(false);
      setAutoFeedBatchSelection(false);
      setAutoFeedBatchSelectionMode("USER_SELECTED");
      setAutoMortalityRateBatchSelection(false);
    } finally {
      setLoading(false);
    }
  }, [activeFarmId, setValue]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

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
      toast("Flock Card settings saved successfully");
    } catch (error) {
      toast("Error: " + errorMessage(error, "Unable to save Flock Card settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Breadcrumb
          FirstPreviewsPageName="Settings"
          CurrentPageName="Growing & Farm Condition Settings"
        />
        <Button type="button" variant="secondary" onClick={fetchSettings} disabled={loading || saving || !activeFarmId}>
          <RefreshCcw className={loading ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Growing &amp; Farm Condition Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid gap-x-12 gap-y-6 lg:grid-cols-2">
              <div className="space-y-6">
                <UserFarmSearchCombobox
                  label="Farm"
                  required
                  value={activeFarmId}
                  onValueChange={(farmId, farm) => {
                    setSelectedFarmId(farmId);
                    setSelectedFarm(farm ?? null);
                  }}
                />

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="allow-advance-posting"
                      checked={allowAdvancePosting}
                      disabled={loading || saving || canEdit || !activeFarmId}
                      onCheckedChange={(checked) => setAllowAdvancePosting(checked === true)}
                    />
                    <Label htmlFor="allow-advance-posting" className="text-sm font-medium">
                      Allow advance posting
                    </Label>
                  </div>
                  <p className="pl-7 text-sm leading-relaxed text-muted-foreground">
                    Allows users to post Flock Card rows ahead of the current flock age.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="auto-mortality-rate-batch-selection"
                      checked={autoMortalityRateBatchSelection}
                      disabled={loading || saving || canEdit || !activeFarmId}
                      onCheckedChange={(checked) => setAutoMortalityRateBatchSelection(checked === true)}
                    />
                    <Label htmlFor="auto-mortality-rate-batch-selection" className="text-sm font-medium">
                      Auto mortality rate batch selection
                    </Label>
                  </div>
                  <p className="pl-7 text-sm leading-relaxed text-muted-foreground">
                    When selected, mortality is prorated across placement batches without decimals because birds are whole units. For 3 batches and 7 mortality, the split can be batch 1: 3, batch 2: 2, batch 3: 2.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="auto-feed-batch-selection"
                      checked={autoFeedBatchSelection}
                      disabled={loading || saving || canEdit || !activeFarmId}
                      onCheckedChange={(checked) => setAutoFeedBatchSelection(checked === true)}
                    />
                    <Label htmlFor="auto-feed-batch-selection" className="text-sm font-medium">
                      Auto feed batch selection
                    </Label>
                  </div>
                  <p className="pl-7 text-sm leading-relaxed text-muted-foreground">
                    When users go to the new Flock Card route, available feed batches are shown automatically.
                  </p>

                  <RadioGroup
                    value={autoFeedBatchSelectionMode}
                    onValueChange={(value) => setAutoFeedBatchSelectionMode(value as AutoFeedBatchSelectionMode)}
                    className="gap-3 pl-7 pt-1"
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
              </div>
            </div>

            <div className="flex gap-3 border-t pt-6">
              <Button type="submit" disabled={!canSave}>
                <Save className="mr-2 size-4" />
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
