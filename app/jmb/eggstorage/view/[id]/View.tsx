// app/jmb/eggstorage/view/[id]/page.tsx

"use client";

import Breadcrumb from "@/lib/Breadcrumb";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/Supabase/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { usePermission } from "@/hooks/usePermission";

interface EggStorageMngt {
    id: number;
    created_at: string;
    created_by: string;
    updated_at: string | null;
    stor_temp: string | null;
    room_temp: string | null;
    stor_humi: string | null;
    shell_start: string | null;
    shell_end: string | null;
    duration: number | null;
    remarks: string | null;
    classi_ref_no: string | null;
}

function formatDuration(sec: number | null) {
    if (sec == null) return "-";

    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);

    if (hours <= 0) return `${minutes}m`;

    return `${hours}h ${minutes}m`;
}

function formatDate(date: string | null) {
    if (!date) return "-";

    return new Date(date).toLocaleString();
}

export default function EggStorageViewPage() {
    const params = useParams();
    const router = useRouter();
    // const canInsert = usePermission('/jmb/hatcheryclassi/insert')
    const canView = usePermission('/jmb/eggstorage/view')
    useEffect(() => {
        if (canView)
            router.push("/jmb/eggstorage/")
    }, [])
    const id = params?.id;

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<EggStorageMngt | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);

            const { data, error } = await db
                .from("egg_storage_mngt")
                .select("*")
                .eq("id", id)
                .single();

            if (error) {
                console.log(error);
                return;
            }

            setData(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshSessionx(router);
    }, []);

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    return (
        <div className="p-4 mt-4">
            <Breadcrumb
                CurrentPageName="View Egg Storage"
                FirstPreviewsPageName="Hatchery"
            />

            <div className="flex items-center justify-between mb-4">
                <Button
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Button>

                <Button
                    variant="outline"
                    className="flex items-center gap-2"
                    onClick={fetchData}
                    disabled={loading}
                >
                    <RefreshCw className="w-4 h-4" />
                    {loading ? "Loading..." : "Refresh"}
                </Button>
            </div>

            <Card className="rounded-2xl shadow-sm">
                <CardContent className="p-6">
                    {loading ? (
                        <div className="text-center py-10 text-muted-foreground">
                            Loading...
                        </div>
                    ) : !data ? (
                        <div className="text-center py-10 text-muted-foreground">
                            No record found.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Egg Reference No.
                                </p>
                                <p className="font-medium">
                                    {data.classi_ref_no || "-"}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Storage Temperature ℃
                                </p>
                                <p className="font-medium">
                                    {data.stor_temp || "-"}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Room Temperature ℃
                                </p>
                                <p className="font-medium">
                                    {data.room_temp || "-"}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Storage Humidity %
                                </p>
                                <p className="font-medium">
                                    {data.stor_humi || "-"}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Shell Temp Start
                                </p>
                                <p className="font-medium">
                                    {formatDate(data.shell_start)}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Shell Temp End
                                </p>
                                <p className="font-medium">
                                    {formatDate(data.shell_end)}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Duration
                                </p>
                                <p className="font-medium">
                                    {formatDuration(data.duration)}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Created At
                                </p>
                                <p className="font-medium">
                                    {formatDate(data.created_at)}
                                </p>
                            </div>

                            <div className="md:col-span-2">
                                <p className="text-sm text-muted-foreground">
                                    Remarks
                                </p>

                                <div className="mt-2 border rounded-xl p-4 min-h-[120px] bg-muted/20 whitespace-pre-wrap">
                                    {data.remarks || "-"}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}