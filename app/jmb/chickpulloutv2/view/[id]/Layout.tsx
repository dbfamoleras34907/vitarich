"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import Breadcrumb from "@/lib/Breadcrumb";

import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { ArrowLeft, Loader2 } from "lucide-react";

import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { db } from "@/lib/Supabase/supabaseClient";
import { usePermission } from "@/hooks/usePermission";


interface EggHatcheryProcess {
  id: number;

  egg_ref: string | null;

  farm_source: string | null;

  daterec: string | null;

  machine_no: string | null;

  hatch_temp: string | null;

  hatch_humidity: string | null;

  hatch_time_start: string | null;

  hatch_time_end: string | null;

  duration: number | null;

  hatch_window: number | null;

  total_egg: number | null;

  created_at: string | null;

  updated_at: string | null;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const d = new Date(value);

  if (isNaN(d.getTime())) return "-";

  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDuration(
  mins: number | string | null | undefined,
) {
  if (mins == null || mins === "") return "-";

  const n =
    typeof mins === "string" ? Number(mins) : mins;

  if (!Number.isFinite(n) || n < 0) return "-";

  const totalMins = Math.round(n);

  const h = Math.floor(totalMins / 60);

  const m = totalMins % 60;

  if (h <= 0) return `${m}m`;

  return `${h}h ${m}m`;
}

export default function EggHatcheryViewPage() {
  const params = useParams();
  const router = useRouter();
  const canView = usePermission("/jmb/chickpulloutv2/view");

  useEffect(() => {
    if (canView == null) return
    canView === true && router.replace("/jmb/chickpulloutv2")
  }, [canView])

  const [loading, setLoading] = useState(true);

  const [data, setData] =
    useState<EggHatcheryProcess | null>(null);

  const id = params?.id;

  async function fetchData() {
    try {
      setLoading(true);

      const { data, error } = await db
        .from("egg_hatchery_process")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {

        setData(null);

        return;
      }

      setData(data);
    } catch (e) {
      console.error(e);

      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshSessionx(router);
  }, []);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  return (
    <div className="rounded-md p-4 mt-4">
      <div className="flex items-center justify-between">
        <Breadcrumb
          SecondPreviewPageName="Hatchery"
          CurrentPageName="Egg Hatchery"
        />

        <Button
          variant="outline"
          onClick={() =>
            router.push("/jmb/egghatcherv2")
          }
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="mt-6">
        <Card className="rounded-2xl">
          <CardContent className="p-6">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : !data ? (
              <div className="text-sm text-muted-foreground">
                No record found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Egg Reference No.
                  </label>

                  <p className="mt-1 text-base">
                    {data.egg_ref || "-"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Farm Source
                  </label>

                  <p className="mt-1 text-base">
                    {data.farm_source || "-"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Date Received
                  </label>

                  <p className="mt-1 text-base">
                    {data.daterec || "-"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Machine No.
                  </label>

                  <p className="mt-1 text-base">
                    {data.machine_no || "-"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Hatch Temperature
                  </label>

                  <p className="mt-1 text-base">
                    {data.hatch_temp || "-"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Hatch Humidity
                  </label>

                  <p className="mt-1 text-base">
                    {data.hatch_humidity || "-"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Hatch Time Start
                  </label>

                  <p className="mt-1 text-base">
                    {formatDateTime(
                      data.hatch_time_start,
                    )}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Hatch Time End
                  </label>

                  <p className="mt-1 text-base">
                    {formatDateTime(
                      data.hatch_time_end,
                    )}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Duration
                  </label>

                  <p className="mt-1 text-base">
                    {formatDuration(data.duration)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Hatch Window
                  </label>

                  <p className="mt-1 text-base">
                    {formatDuration(
                      data.hatch_window,
                    )}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Total Egg
                  </label>

                  <p className="mt-1 text-base">
                    {data.total_egg?.toLocaleString() ||
                      "-"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Created At
                  </label>

                  <p className="mt-1 text-base">
                    {formatDateTime(data.created_at)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Updated At
                  </label>

                  <p className="mt-1 text-base">
                    {formatDateTime(data.updated_at)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}