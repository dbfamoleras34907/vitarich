"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  const { setValue } = useGlobalContext();
  const [settings, setSettings] = useState<FlockCardSettings | null>(null);
  const [allowAdvancePosting, setAllowAdvancePosting] = useState(false);
  const [autoFeedBatchSelection, setAutoFeedBatchSelection] = useState(false);
  const [autoFeedBatchSelectionMode, setAutoFeedBatchSelectionMode] =
    useState<AutoFeedBatchSelectionMode>("USER_SELECTED");
  const [autoMortalityRateBatchSelection, setAutoMortalityRateBatchSelection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(
    () => !saving && !loading && !canEdit,
    [canEdit, loading, saving],
  );

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const nextSettings = await getFlockCardSettings();
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
  }, [setValue]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!canSave) {
      toast("You do not have permission to edit this setting.");
      return;
    }

    setSaving(true);
    try {
      const saved = await saveFlockCardSettings({
        id: settings?.id,
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
          CurrentPageName="Flock Card Settings"
        />
        <Button type="button" variant="secondary" onClick={fetchSettings} disabled={loading || saving}>
          <RefreshCcw className={loading ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Flock Card Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid gap-x-12 gap-y-6 lg:grid-cols-2">
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="allow-advance-posting"
                      checked={allowAdvancePosting}
                      disabled={loading || saving || canEdit}
                      onCheckedChange={(checked) => setAllowAdvancePosting(checked === true)}
                    />
                    <Label htmlFor="allow-advance-posting" className="text-sm font-medium">
                      Allow advance posting
                    </Label>
                  </div>
                  <p className="pl-7 text-sm leading-relaxed text-muted-foreground">
                    Allows Flock Card feed intake rows with existing postings to be edited and posted again.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="auto-mortality-rate-batch-selection"
                      checked={autoMortalityRateBatchSelection}
                      disabled={loading || saving || canEdit}
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
                      disabled={loading || saving || canEdit}
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
