// /jmb/prewarmingv2/view/[id]/page.tsx

"use client";

import Breadcrumb from "@/lib/Breadcrumb";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { EggPreWarming, getEggPreWarmingById } from "../../new2/api";
import { usePermission } from "@/hooks/usePermission";


export default function Layout() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();


  const canView = usePermission('/jmb/prewarmingv2/view')
  useEffect(() => {
    if (canView)
      router.push("/jmb/prewarmingv2/")
  }, [])


  const [data, setData] = useState<EggPreWarming | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        const res = await getEggPreWarmingById(parseInt(id));

        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchData();
    }
  }, [id]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";

    return new Date(value).toLocaleString();
  };

  return (
    <div className="p-4 space-y-4">
      <Breadcrumb
        CurrentPageName="Pre-Warming"
        FirstPreviewsPageName="Hatchery"
      />

      <div className="bg-white rounded-xl border shadow-sm p-6">
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
            <Field label="ID" value={data.id} />
            <Field
              label="Created At"
              value={formatDateTime(data.created_at)}
            />

            <Field
              label="Egg Reference No"
              value={data.egg_ref_no}
            />

            <Field
              label="Pre Warming Temp"
              value={data.pre_temp}
            />

            <Field
              label="Egg Temp"
              value={data.egg_temp}
            />

            <Field
              label="Temp Start"
              value={formatDateTime(data.egg_temp_time_start)}
            />

            <Field
              label="Temp End"
              value={formatDateTime(data.egg_temp_time_end)}
            />

            <Field
              label="Duration"
              value={
                data.duration
                  ? `${data.duration} mins`
                  : "-"
              }
            />

            <Field
              label="Remarks"
              value={data.remarks}
            />

            <Field
              label="Active"
              value={data.is_active ? "Yes" : "No"}
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