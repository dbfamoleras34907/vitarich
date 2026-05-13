"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ClipboardCopy, Copy, FileSearch, MoreHorizontal, Pencil, Plus, RefreshCw, View } from "lucide-react";

import {
  EggStorageMngt,
  listEggStorage,
} from "./new/api";

import Breadcrumb from "@/lib/Breadcrumb";
import EditActionButton from "@/components/EditActionButton";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import { useGlobalContext } from "@/lib/context/GlobalContext";

import DynamicTable from "@/components/ui/DataTableV2";
import { ColumnConfig, RowDataKey } from "@/lib/Defaults/DefaultTypes";
import { RowAction } from "@/lib/types";
import { copyRow, copyTable } from "@/lib/tableActions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePermission } from "@/hooks/usePermission";

function fmtDuration(sec: number | null) {
  if (sec == null) return "";
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);

  if (hours <= 0) return `${minutes}m`;

  return `${hours}h ${minutes}m`;
}

export default function EggTable() {
  const [items, setItems] = useState<RowDataKey[]>([]);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  // const canInsert = usePermission('/jmb/hatcheryclassi/insert')
  const canView = usePermission('/jmb/eggstorage/view')
  const canInsert = usePermission('/jmb/eggstorage/insert')
  const canEdit = usePermission('/jmb/eggstorage/edit')

  
  const { setValue } = useGlobalContext();

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
        key: "classi_ref_no",
        label: "Egg Reference No.",
        type: "text",
        disabled: true,
      },
      {
        key: "stor_temp",
        label: "Storage Temperature ℃",
        type: "text",
        disabled: true,
      },
      {
        key: "room_temp",
        label: "Room Temperature ℃",
        type: "text",
        disabled: true,
      },
      {
        key: "stor_humi",
        label: "Storage Humidity %",
        type: "text",
        disabled: true,
      },
      {
        key: "shell_start",
        label: "Shell Temp Start",
        type: "text",
        disabled: true,
      },
      {
        key: "shell_end",
        label: "Shell Temp End",
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

  const fetchItems = async () => {
    try {
      setLoading(true);

      const data = await listEggStorage();

      const mapped =
        Array.isArray(data)
          ? data.map((item: EggStorageMngt, index: number) => ({
            id: item.id,
            "#": index + 1,
            classi_ref_no: item.classi_ref_no || "-",
            stor_temp: item.stor_temp || "-",
            room_temp: item.room_temp || "-",
            stor_humi: item.stor_humi || "-",
            shell_start: item.shell_start
              ? new Date(item.shell_start).toLocaleString()
              : "-",
            shell_end: item.shell_end
              ? new Date(item.shell_end).toLocaleString()
              : "-",
            duration: fmtDuration(item.duration),
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
  };

  useEffect(() => {
    refreshSessionx(router);
  }, []);

  useEffect(() => {
    router.prefetch("/jmb/eggstorage/new");
    fetchItems();
  }, []);

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
          router.push(`/jmb/eggstorage/view/${row.id}`);
        },
      },

      {
        label: "Edit",
        disabled: canEdit,

        icon: <Pencil className="w-4 h-4" />,
        onClick: () => {
          router.push(`/jmb/eggstorage/new?id=${row.id}`);
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
      <div className="flex justify-between items-center">

        <Breadcrumb
          CurrentPageName="Egg Storage Management"
          FirstPreviewsPageName="Hatchery"
        />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={fetchItems}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            {loading ? "Loading..." : "Refresh"}
          </Button>

          <Button
            type="button"
            onClick={() => router.push("/jmb/eggstorage/new")}
            disabled={canInsert}
          >
            <Plus className="size-4" />
            Egg Storage
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

              // row actions
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

              if (value === null || value === undefined || value === "") {
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