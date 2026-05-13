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
  SetterIncubation,
  listSetterIncubations,
} from "./new/api";

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

import { usePermission } from "@/hooks/usePermission";

export default function EggsetterTable() {
  const [items, setItems] = useState<RowDataKey[]>([]);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const { setValue } = useGlobalContext();

  const canView = usePermission("/jmb/eggsetter/view");
  const canInsert = usePermission("/jmb/eggsetter/insert");
  const canEdit = usePermission("/jmb/eggsetter/edit");

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";

    const d = new Date(value);

    const pad = (n: number) => String(n).padStart(2, "0");

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate(),
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

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
        key: "setting_date",
        label: "Setting Date",
        type: "text",
        disabled: true,
      },

      {
        key: "machine_id",
        label: "Setter Machine ID",
        type: "text",
        disabled: true,
      },

      {
        key: "total_eggs",
        label: "Total Eggs",
        type: "text",
        disabled: true,
      },

      {
        key: "incubation_duration",
        label: "Incubation (days)",
        type: "text",
        disabled: true,
      },

      {
        key: "setter_temp",
        label: "Temp (°F)",
        type: "text",
        disabled: true,
      },

      {
        key: "setter_humidity",
        label: "Humidity (%)",
        type: "text",
        disabled: true,
      },

      {
        key: "turning_interval",
        label: "Turning Interval (mins)",
        type: "text",
        disabled: true,
      },

      {
        key: "turning_angle",
        label: "Turning Angle (°)",
        type: "text",
        disabled: true,
      },

      {
        key: "egg_shell_temp",
        label: "Egg Shell Temp (°F)",
        type: "text",
        disabled: true,
      },

      {
        key: "egg_shell_temp_dt",
        label: "Egg Shell Temp Date & Time",
        type: "text",
        disabled: true,
      },

      {
        key: "egg_shell_orientation",
        label: "Egg Shell Orientation",
        type: "text",
        disabled: true,
      },
    ],
    [],
  );

  const fetchData = async () => {
    setLoading(true);

    try {
      const data = await listSetterIncubations();

      const mapped =
        Array.isArray(data)
          ? data.map((item: SetterIncubation, index: number) => ({
            id: item.id,

            "#": index + 1,

            ref_no: item.ref_no || "-",

            setting_date: formatDateTime(item.setting_date),

            machine_id: item.machine_id || "-",

            total_eggs:
              item.total_eggs?.toLocaleString() || "-",

            incubation_duration:
              item.incubation_duration || "-",

            setter_temp: item.setter_temp || "-",

            setter_humidity:
              item.setter_humidity || "-",

            turning_interval:
              item.turning_interval || "-",

            turning_angle: item.turning_angle || "-",

            egg_shell_temp:
              item.egg_shell_temp || "-",

            egg_shell_temp_dt: formatDateTime(
              item.egg_shell_temp_dt,
            ),

            egg_shell_orientation:
              item.egg_shell_orientation || "-",
          }))
          : [];

      setItems(mapped);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSessionx(router);
  }, []);

  useEffect(() => {
    (async () => {
      router.prefetch("/jmb/eggsetter/new");

      await fetchData();
    })();
  }, []);

  useEffect(() => {
    setValue("loading_g", loading);
  }, [loading]);

  const getRowActions = (row: RowDataKey): RowAction[] => {
    return [
      {
        label: "View",
        icon: <FileSearch className="w-4 h-4" />,
        disabled: canView ,

        onClick: () => {
          router.push(`/jmb/eggsetter/view/${row.id}`);
        },
      },

      {
        label: "Edit",
        disabled: canEdit ,

        icon: <Pencil className="w-4 h-4" />,

        onClick: () => {
          router.push(`/jmb/eggsetter/new?id=${row.id}`);
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
    <div className="rounded-md p-4 mt-4">
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        CurrentPageName="Egg Setter List"
      />

      <br />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className="size-4" />

            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <Button
          type="button"
          onClick={() => router.push("/jmb/eggsetter/new")}
          disabled={canInsert }
          className="flex items-center gap-2"
        >
          <Plus className="size-4" />
          New Record
        </Button>
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