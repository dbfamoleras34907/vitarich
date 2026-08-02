"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import UserFarmSearchCombobox, { getAllowedUserFarms, type UserFarm } from "@/components/ui/UserFarmSearchCombobox";
import Breadcrumb from "@/lib/Breadcrumb";
import { usePermission } from "@/hooks/usePermission";
import { useGlobalContext } from "@/lib/context/GlobalContext";
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

  const resetSettingsForm = useCallback(() => {
    setSettings(null);
    setBatchAutoSelection(false);
    setTargetDeliveryAge("0");
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
      toast("BR Delivery settings saved successfully");
    } catch (error) {
      toast("Error: " + errorMessage(error, "Unable to save BR Delivery settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Breadcrumb
          FirstPreviewsPageName="Settings"
          CurrentPageName="BR Delivery Settings"
        />
        <Button type="button" variant="secondary" onClick={fetchSettings} disabled={loading || saving || !activeFarmId}>
          <RefreshCcw className={loading ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>BR Delivery Settings</CardTitle>
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
                  <Label htmlFor="target-delivery-age">Target Delivery Age</Label>
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
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Minimum DOC age in days required before a BR Delivery can be posted.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="batch-auto-selection"
                      checked={batchAutoSelection}
                      disabled={loading || saving || canEdit || !activeFarmId}
                      onCheckedChange={(checked) => setBatchAutoSelection(checked === true)}
                    />
                    <Label htmlFor="batch-auto-selection" className="text-sm font-medium">
                      Batch Auto selection
                    </Label>
                  </div>
                  <div className="space-y-1 pl-7 text-sm leading-relaxed text-muted-foreground">
                    <p>Automatically selects the batch when only one available batch is found.</p>
                    <p>Displays batch selection when multiple available batches are found.</p>
                  </div>
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
