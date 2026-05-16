// /jmb/chickgradingv2/view/[id]/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { Loader2 } from "lucide-react";

import Breadcrumb from "@/lib/Breadcrumb";

import {
  ChickGradingProcess,
  getChickGradingProcessById,
} from "../../newv2/api";

function fmtNumber(
  value?: number | string | null,
) {
  if (value == null || value === "") {
    return "-";
  }

  return new Intl.NumberFormat("en-PH").format(
    Number(value),
  );
}

function fmtDecimal(
  value?: number | string | null,
) {
  if (value == null || value === "") {
    return "-";
  }

  return Number(value).toFixed(2);
}

function fmtDateTime(
  value?: string | null,
) {
  if (!value) return "-";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "-";
  }

  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function ViewChickGradingPage() {
  const params = useParams();

  const id = params.id as string;

  const [loading, setLoading] =
    useState(true);

  const [data, setData] =
    useState<ChickGradingProcess | null>(
      null,
    );

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const res =
          await getChickGradingProcessById(
            parseInt(id),
          );

        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      load();
    }
  }, [id]);

  return (
    <div className="p-4 space-y-4">
      <Breadcrumb
        CurrentPageName="Chick Grading Process"
        FirstPreviewsPageName="Hatchery"
      />

      <div className="bg-white border rounded-2xl shadow-sm p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !data ? (
          <div className="text-center py-20 text-muted-foreground">
            No data found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="ID"
              value={data.id}
            />

            <Field
              label="Batch Code"
              value={data.batch_code}
            />

            <Field
              label="Egg Reference No."
              value={data.egg_ref_no}
            />

            <Field
              label="Class A"
              value={fmtNumber(
                data.class_a,
              )}
            />

            <Field
              label="Class B"
              value={fmtNumber(
                data.class_b,
              )}
            />

            <Field
              label="Class A Junior"
              value={fmtNumber(
                data.class_a_junior,
              )}
            />

            <Field
              label="Class C"
              value={fmtNumber(
                data.class_c,
              )}
            />

            <Field
              label="Cull Chicks"
              value={fmtNumber(
                data.cull_chicks,
              )}
            />

            <Field
              label="Dead Chicks"
              value={fmtNumber(
                data.dead_chicks,
              )}
            />

            <Field
              label="Infertile"
              value={fmtNumber(
                data.infertile,
              )}
            />

            <Field
              label="Dead Germ"
              value={fmtNumber(
                data.dead_germ,
              )}
            />

            <Field
              label="Live Pip"
              value={fmtNumber(
                data.live_pip,
              )}
            />

            <Field
              label="Dead Pip"
              value={fmtNumber(
                data.dead_pip,
              )}
            />

            <Field
              label="Unhatched"
              value={fmtNumber(
                data.unhatched,
              )}
            />

            <Field
              label="Rotten"
              value={fmtNumber(
                data.rotten,
              )}
            />

            <Field
              label="Exploder"
              value={fmtNumber(
                data.exploder,
              )}
            />

            <Field
              label="Unhatched Good"
              value={fmtNumber(
                data.unhatched_good,
              )}
            />

            <Field
              label="Unhatched Bad"
              value={fmtNumber(
                data.unhatched_bad,
              )}
            />

            <Field
              label="Infertile Good"
              value={fmtNumber(
                data.infertile_good,
              )}
            />

            <Field
              label="Infertile Bad"
              value={fmtNumber(
                data.infertile_bad,
              )}
            />

            <Field
              label="Chick Room Temperature"
              value={fmtDecimal(
                data.chick_room_temperature,
              )}
            />

            <Field
              label="Grading Personnel"
              value={
                data.grading_personnel
              }
            />

            <Field
              label="Grading DateTime"
              value={fmtDateTime(
                data.grading_datetime,
              )}
            />

            <Field
              label="Created At"
              value={fmtDateTime(
                data.created_at,
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm text-muted-foreground">
        {label}
      </div>

      <div className="border rounded-lg px-3 py-2 min-h-[42px] bg-muted/30">
        {value || "-"}
      </div>
    </div>
  );
}