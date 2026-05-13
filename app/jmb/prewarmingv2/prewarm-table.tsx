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
import { useGlobalContext } from "@/lib/context/GlobalContext";

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
  listEggPreWarming,
  type EggPreWarming,
} from "./new2/api";

import { usePermission } from "@/hooks/usePermission";

function fmtDuration(mins: number | null) {
  if (mins == null) return "";

  const h = Math.floor(mins / 60);
  const m = mins % 60;

  if (h <= 0) return `${m} min`;

  return `${h} hr ${m} min`;
}

export default function PrewarmTable() {
  const router = useRouter();

  const [items, setItems] = useState<RowDataKey[]>([]);
  const [loading, setLoading] = useState(false);

  const { setValue } = useGlobalContext();

  const canView = usePermission("/jmb/prewarmingv2/view");
  const canEdit = usePermission("/jmb/prewarmingv2/edit");
  const canInsert = usePermission("/jmb/prewarmingv2/insert");

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
        key: "egg_ref_no",
        label: "Egg Reference No.",
        type: "text",
        disabled: true,
      },
      {
        key: "pre_temp",
        label: "Pre-Warming Temp ℃",
        type: "text",
        disabled: true,
      },
      {
        key: "egg_temp",
        label: "Egg Shell Temp ℃",
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
        key: "remarks",
        label: "Remarks",
        type: "text",
        disabled: true,
      },
    ],
    [],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const rows = await listEggPreWarming();

      const mapped =
        Array.isArray(rows)
          ? rows.map((item: EggPreWarming, index: number) => ({
              id: item.id,
              "#": index + 1,
              egg_ref_no: item.egg_ref_no || "-",
              pre_temp: item.pre_temp || "-",
              egg_temp: item.egg_temp || "-",
              duration: fmtDuration(
                (item.duration as number | null) ?? null,
              ),
              remarks: item.remarks || "-",
            }))
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
    router.prefetch("/jmb/prewarmingv2/new2");
    load();
  }, [router, load]);

  useEffect(() => {
    setValue("loading_g", loading);
  }, [loading]);

  const getRowActions = (row: RowDataKey): RowAction[] => {
    return [
      {
        label: "View",
        icon: <FileSearch className="w-4 h-4" />,
        disabled: canView,
        onClick: () => {
          router.push(`/jmb/prewarmingv2/view/${row.id}`);
        },
      },

      {
        label: "Edit",
        disabled: canEdit,

        icon: <Pencil className="w-4 h-4" />,
        onClick: () => {
          router.push(`/jmb/prewarmingv2/new2?id=${row.id}`);
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
        icon: <ClipboardCopy className="w-4 h-4" />,
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
          FirstPreviewsPageName="Hatchery"
          CurrentPageName="Pre-Warming"
        />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            {loading ? "Loading..." : "Refresh"}
          </Button>

          <Button
            type="button"
            onClick={() => router.push("/jmb/prewarmingv2/new2")}
            disabled={canInsert}
          >
            <Plus className="size-4" />
            New Pre-Warming
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <DynamicTable
          loading={loading}
          initialFilters={[]}
          columns={tableColumns.map((col) => ({
            key: col.key,
            label: col.label,
            align: col.key === "action" ? "right" : "left",

            render: (row: RowDataKey) => {
              const key = col.key;

              if (key === "action") {
                const actions = getRowActions(row);

                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="xs">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                      {actions.map((action, index) => (
                        <DropdownMenuItem
                          key={index}
                          disabled={action.disabled}
                          onClick={() => action.onClick(row)}
                          className="cursor-pointer flex items-center gap-2"
                        >
                          {action.icon}
                          {action.label}
                        </DropdownMenuItem>
                      ))}
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