"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  ClipboardCopy,
  Copy,
  FileSearch,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";

import Breadcrumb from "@/lib/Breadcrumb";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";

import DynamicTable from "@/components/ui/DataTableV2";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ColumnConfig, RowDataKey } from "@/lib/Defaults/DefaultTypes";
import { RowAction } from "@/lib/types";

import { copyRow, copyTable } from "@/lib/tableActions";

import {
  listEggHatcheryProcess,
  type EggHatcheryProcess,
} from "./newv2/api";

import { usePermission } from "@/hooks/usePermission";

function fmtDateTime(v: string | null | undefined) {
  if (!v) return "";

  const d = new Date(v);

  if (Number.isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(
    d.getMonth() + 1,
  )}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function fmtNumber(v: number | null | undefined) {
  if (v == null) return "";

  return new Intl.NumberFormat("en-PH").format(v);
}

function fmtDurationHHMM(
  mins: number | string | null | undefined,
) {
  if (mins == null || mins === "") return "";

  const n = typeof mins === "string"
    ? Number(mins)
    : mins;

  if (!Number.isFinite(n) || n < 0) return "";

  const totalMins = Math.round(n);

  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;

  if (h <= 0) return `${m}m`;

  return `${h}h ${m}m`;
}

export default function EggHatchTable() {
  const router = useRouter();

  const [items, setItems] = useState<RowDataKey[]>([]);
  const [loading, setLoading] = useState(false);

  const canView = usePermission("/jmb/egghatcherv2/view");
  const canEdit = usePermission("/jmb/egghatcherv2/edit");
  const canInsert = usePermission("/jmb/egghatcherv2/insert");

  const tableColumns: ColumnConfig[] = useMemo(
    () => [
      {
        key: "#",
        label: "#",
        type: "text",
        disabled: true,
      },
      {
        key: "action",
        label: "Action",
        type: "button",
        disabled: false,
      },
      {
        key: "egg_ref",
        label: "Egg Reference No.",
        type: "text",
        disabled: true,
      },
      {
        key: "daterec",
        label: "Date Rec",
        type: "text",
        disabled: true,
      },
      {
        key: "machine_no",
        label: "Machine No",
        type: "text",
        disabled: true,
      },
      {
        key: "hatch_time_start",
        label: "Start",
        type: "text",
        disabled: true,
      },
      {
        key: "hatch_time_end",
        label: "End",
        type: "text",
        disabled: true,
      },
      {
        key: "duration",
        label: "Hatch Window",
        type: "text",
        disabled: true,
      },
      {
        key: "total_egg",
        label: "Total Egg",
        type: "text",
        disabled: true,
      },
    ],
    [],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const rows = await listEggHatcheryProcess();

      const mapped =
        Array.isArray(rows)
          ? rows.map(
              (
                item: EggHatcheryProcess,
                index: number,
              ) => ({
                id: item.id,

                "#": index + 1,

                egg_ref: item.egg_ref || "-",

                daterec: item.daterec || "-",

                machine_no:
                  item.machine_no || "-",

                hatch_time_start: fmtDateTime(
                  item.hatch_time_start,
                ),

                hatch_time_end: fmtDateTime(
                  item.hatch_time_end,
                ),

                duration: fmtDurationHHMM(
                  item.duration,
                ),

                total_egg: fmtNumber(
                  item.total_egg,
                ),
              }),
            )
          : [];

      setItems(mapped);
    } catch (e) {
      console.error(e);

      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSessionx(router);
  }, []);

  useEffect(() => {
    router.prefetch("/jmb/egghatcherv2/newv2");

    load();
  }, [router, load]);

  const getRowActions = (
    row: RowDataKey,
  ): RowAction[] => {
    return [
      {
        label: "View",
        icon: (
          <FileSearch className="w-4 h-4" />
        ),
        disabled: canView,
        onClick: () => {
          router.push(
            `/jmb/egghatcherv2/view/${row.id}`,
          );
        },
      },

      {
        label: "Edit",
        disabled: canEdit,

        icon: <Pencil className="w-4 h-4" />,

        onClick: () => {
          router.push(
            `/jmb/egghatcherv2/newv2?id=${row.id}`,
          );
        },
      },

      {
        label: "Copy Row",
        icon: <Copy className="w-4 h-4" />,
        onClick: () => {
          copyRow(row);
        },
      },

      {
        label: "Copy Table",
        icon: (
          <ClipboardCopy className="w-4 h-4" />
        ),
        onClick: () => {
          copyTable(items);
        },
      },
    ];
  };

  return (
    <div className="rounded-md p-4">
      <div className="flex justify-between items-center">
        <Breadcrumb
          SecondPreviewPageName="Hatchery"
          CurrentPageName="Egg Hatchery"
        />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />

            {loading
              ? "Refreshing..."
              : "Refresh"}
          </Button>

          <Button
            type="button"
            onClick={() =>
              router.push(
                "/jmb/egghatcherv2/newv2",
              )
            }
            disabled={canInsert}
          >
            <Plus className="size-4" />
            New Egg Hatch
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <DynamicTable
          loading={loading}
          initialFilters={[]}
          data={items}
          columns={tableColumns.map((col) => ({
            key: col.key,
            label: col.label,
            align:
              col.key === "action"
                ? "right"
                : "left",

            render: (row: RowDataKey) => {
              const key = col.key;

              if (key === "action") {
                const actions =
                  getRowActions(row);

                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="xs">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                      {actions.map(
                        (action, index) => (
                          <DropdownMenuItem
                            key={index}
                            disabled={
                              action.disabled
                            }
                            onClick={() =>
                              action.onClick(
                                row,
                              )
                            }
                            className="cursor-pointer flex items-center gap-2"
                          >
                            {action.icon}
                            {action.label}
                          </DropdownMenuItem>
                        ),
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              const value = row[key];

              if (
                value === null ||
                value === undefined ||
                value === ""
              ) {
                return "-";
              }

              return String(value);
            },
          }))}
        />
      </div>
    </div>
  );
}