// /jmb/eggsetter/view/[id]/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import Breadcrumb from "@/lib/Breadcrumb";
import { getSetterIncubationProcessById, SetterIncubationProcess } from "./api";



export default function Layout() {
    const params = useParams();
    const id = params.id as string;

    const [data, setData] = useState<SetterIncubationProcess | null>(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);

                const res =
                    await getSetterIncubationProcessById(id);

                setData(res);
            } catch (err) {
                // console.error(err);
            } finally {
                setLoading(false);
            }
        }

        if (id) {
            fetchData();
        }
    }, [id]);

    const formatDate = (value?: string | null) => {
        if (!value) return "-";

        return new Date(value).toLocaleDateString();
    };

    const formatDateTime = (value?: string | null) => {
        if (!value) return "-";

        return new Date(value).toLocaleString();
    };

    return (
        <div className="p-4 space-y-4">
            <Breadcrumb
                CurrentPageName="Egg Setter"
                FirstPreviewsPageName="Hatchery"
            />

            <div className="bg-white border rounded-xl shadow-sm p-6">
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
                            label="Reference No"
                            value={data.ref_no}
                        />

                        <Field
                            label="Setting Date"
                            value={formatDate(data.setting_date)}
                        />

                        <Field
                            label="Farm Source"
                            value={data.farm_source}
                        />

                        <Field
                            label="Machine ID"
                            value={data.machine_id}
                        />

                        <Field
                            label="Total Eggs"
                            value={data.total_eggs}
                        />

                        <Field
                            label="Setter Temperature"
                            value={data.setter_temp}
                        />

                        <Field
                            label="Setter Humidity"
                            value={data.setter_humidity}
                        />

                        <Field
                            label="Turning Interval"
                            value={
                                data.turning_interval
                                    ? `${data.turning_interval} mins`
                                    : "-"
                            }
                        />

                        <Field
                            label="Turning Angle"
                            value={data.turning_angle}
                        />

                        <Field
                            label="Incubation Duration"
                            value={
                                data.incubation_duration
                                    ? `${data.incubation_duration} days`
                                    : "-"
                            }
                        />

                        <Field
                            label="Egg Shell Temperature"
                            value={data.egg_shell_temp}
                        />

                        <Field
                            label="Egg Shell Temp Date Time"
                            value={formatDateTime(
                                data.egg_shell_temp_dt
                            )}
                        />

                        <Field
                            label="Egg Shell Orientation"
                            value={data.egg_shell_orientation}
                        />

                        <Field
                            label="Qty Set Egg"
                            value={data.qty_set_egg}
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