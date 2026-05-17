// /jmb/eggtransferv2/view/[id]/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import Breadcrumb from "@/lib/Breadcrumb";

import {
    EggTransferProcess,
    getEggTransferById,
} from "../../newv2/api";

function fmtDuration(mins?: number | null) {
    if (mins == null) return "-";

    const h = Math.floor(mins / 60);
    const m = mins % 60;

    if (h <= 0) return `${m} min`;

    return `${h} hr ${m} min`;
}

function formatDateTime(v?: string | null) {
    if (!v) return "-";

    const d = new Date(v);

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

export default function Layout() {
    const params = useParams();

    const id = params.id as string;

    const [loading, setLoading] = useState(true);

    const [data, setData] =
        useState<EggTransferProcess | null>(null);

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);

                const res = await getEggTransferById(parseInt(id));

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
                CurrentPageName="Egg Transfer"
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
                        <Field label="ID" value={data.id} />

                        <Field
                            label="Egg Reference No."
                            value={data.ref_no}
                        />

                        <Field
                            label="Farm Source"
                            value={data.farm_source}
                        />

                        <Field
                            label="Transfer Start"
                            value={formatDateTime(
                                data.trans_date_start
                            )}
                        />

                        <Field
                            label="Transfer End"
                            value={formatDateTime(
                                data.trans_date_end
                            )}
                        />

                        <Field
                            label="Duration"
                            value={fmtDuration(data.duration)}
                        />

                        <Field
                            label="No. of Bangers"
                            value={data.num_bangers}
                        />

                        <Field
                            label="Total Egg Transfer"
                            value={data.total_egg_transfer}
                        />

                        <Field
                            label="Created At"
                            value={formatDateTime(data.created_at)}
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