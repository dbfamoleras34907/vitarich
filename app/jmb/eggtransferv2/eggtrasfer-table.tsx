"use client";

import { useEffect, useMemo, useState } from "react";
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

import {
  EggTransferProcess,
  listEggTransfers,
} from "./newv2/api";

import Breadcrumb from "@/lib/Breadcrumb";

import { refreshSessionx } from "@/app/admin/user/RefreshSession";

import { formatNumber } from "@/lib/utils/numberFormat";

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

import { usePermission } from "@/hooks/usePermission";

import { useGlobalContext } from "@/lib/context/GlobalContext";

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

export default function EggTransferTable() {
  const [items, setItems] = useState<RowDataKey[]>([]);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const { setValue } = useGlobalContext();

  const canView = usePermission("/jmb/eggtransferv2/view");
  const canInsert = usePermission("/jmb/eggtransferv2/insert");
  const canEdit = usePermission("/jmb/eggtransferv2/edit");

  function fmtDurationHHMM(
    mins: number | string | null | undefined,
  ) {
    if (mins == null || mins === "") return "";

    const n =
      typeof mins === "string" ? Number(mins) : mins;

    if (!Number.isFinite(n) || n < 0) return "";

    const totalMins = Math.round(n);

    const h = Math.floor(totalMins / 60);

    const m = totalMins % 60;

    if (h <= 0) return `${m}m`;

    return `${h}h ${m}m`;
  }

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
        key: "ref_no",
        label: "Egg Reference No.",
        type: "text",
        disabled: true,
      },

      {
        key: "trans_date_start",
        label: "Transfer Start",
        type: "text",
        disabled: true,
      },

      {
        key: "trans_date_end",
        label: "Transfer End",
        type: "text",
        disabled: true,
      },

      {
        key: "duration",
        label: "Duration",
        type: "text",
        disabled: true,
      },

      {
        key: "num_bangers",
        label: "No. of Bangers",
        type: "text",
        disabled: true,
      },

      {
        key: "total_egg_transfer",
        label: "Total Egg Transfer",
        type: "text",
        disabled: true,
      },
    ],
    [],
  );

  async function load() {
    setLoading(true);

    try {
      const data = await listEggTransfers();

      if (
        (data && !Array.isArray(data)) ||
        (Array.isArray(data) &&
          data.length > 0 &&
          "error" in (data as any)[0])
      ) {
        setItems([]);
      } else {
        const mapped =
          Array.isArray(data)
            ? data.map(
                (
                  item: EggTransferProcess,
                  index: number,
                ) => ({
                  id: item.id,

                  "#": index + 1,

                  ref_no: item.ref_no || "-",

                  trans_date_start: formatDateTime(
                    item.trans_date_start,
                  ),

                  trans_date_end: formatDateTime(
                    item.trans_date_end,
                  ),

                  duration: fmtDurationHHMM(
                    item.duration,
                  ),

                  num_bangers: formatNumber(
                    item.num_bangers,
                  ),

                  total_egg_transfer: formatNumber(
                    item.total_egg_transfer,
                  ),
                }),
              )
            : [];

        setItems(mapped);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshSessionx(router);
  }, []);

  useEffect(() => {
    (async () => {
      router.prefetch("/jmb/eggtransferv2/newv2");

      await load();
    })();
  }, [router]);

  useEffect(() => {
    setValue("loading_g", loading);
  }, [loading]);

  const getRowActions = (
    row: RowDataKey,
  ): RowAction[] => {
    return [
      {
        label: "View",
        icon: <FileSearch className="w-4 h-4" />,
        disabled: canView,

        onClick: () => {
          router.push(
            `/jmb/eggtransferv2/view/${row.id}`,
          );
        },
      },

      {
        label: "Edit",
        disabled: canEdit,

        icon: <Pencil className="w-4 h-4" />,

        onClick: () => {
          router.push(
            `/jmb/eggtransferv2/newv2?id=${row.id}`,
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
    <div className="rounded-md p-4 mt-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        CurrentPageName="Egg Transfer"
      />

      <br />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className="size-4" />

            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <Button
          type="button"
          onClick={() =>
            router.push("/jmb/eggtransferv2/newv2")
          }
          disabled={canInsert}
          className="flex items-center gap-2"
        >
          <Plus className="size-4" />
          New Egg Transfer
        </Button>
      </div>

      <div className="mt-4">
        <DynamicTable
          loading={loading}
          initialFilters={[]}
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
                              action.onClick(row)
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
          data={items}
        />
      </div>
    </div>
  );
}