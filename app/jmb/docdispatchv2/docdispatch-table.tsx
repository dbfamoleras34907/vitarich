"use client";

import { useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import Breadcrumb from "@/lib/Breadcrumb";

import { Button } from "@/components/ui/button";

import {
  ClipboardCopy,
  Copy,
  FileSearch,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
} from "lucide-react";

import {
  listDispatchDocs,
  softDeleteDispatchDoc,
} from "./newv2/api";

import { refreshSessionx } from "@/app/admin/user/RefreshSession";

import DynamicTable from "@/components/ui/DataTableV2";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  ColumnConfig,
  RowDataKey,
} from "@/lib/Defaults/DefaultTypes";

import { RowAction } from "@/lib/types";

import {
  copyRow,
  copyTable,
} from "@/lib/tableActions";

import { usePermission } from "@/hooks/usePermission";

import { useGlobalContext } from "@/lib/context/GlobalContext";

type Row = {
  id: number;

  doc_date: string;

  dr_no: string;

  farm_name: string;

  hauler_name: string | null;

  hauler_plate_no: string | null;

  truck_seal_no: string | null;

  chick_van_temp_c: number | null;

  number_of_fans: number | null;

  remarks: string | null;
};

export default function DocdispatchTable() {
  const router = useRouter();

  const [items, setItems] = useState<
    RowDataKey[]
  >([]);

  const [loading, setLoading] =
    useState(false);

  const { setValue } = useGlobalContext();

  const canView = usePermission(
    "/jmb/docdispatchv2/view",
  );

  const canInsert = usePermission(
    "/jmb/docdispatchv2/insert",
  );

  const canEdit = usePermission(
    "/jmb/docdispatchv2/edit",
  );

  async function load() {
    setLoading(true);

    try {
      const rows = await listDispatchDocs();

      const mapped =
        Array.isArray(rows)
          ? rows.map(
            (
              item: Partial<Row>,
              index: number,
            ) => ({
              id: item.id ?? 0,

              "#": index + 1,

              doc_date: item.doc_date || "-",

              dr_no: item.dr_no || "-",

              farm_name: item.farm_name || "-",

              hauler_name:
                item.hauler_name || "-",

              hauler_plate_no:
                item.hauler_plate_no || "-",

              truck_seal_no:
                item.truck_seal_no || "-",

              chick_van_temp_c:
                item.chick_van_temp_c == null
                  ? "-"
                  : `${item.chick_van_temp_c} °C`,

              number_of_fans:
                item.number_of_fans || "-",

              remarks: item.remarks || "-",
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
  }

  useEffect(() => {
    refreshSessionx(router);
  }, []);

  useEffect(() => {
    router.prefetch(
      "/jmb/docdispatchv2/newv2",
    );

    load();
  }, []);

  useEffect(() => {
    setValue("loading_g", loading);
  }, [loading]);

  async function onDelete(id: number) {
    const ok = confirm(
      "Set this record as inactive?",
    );

    if (!ok) return;

    try {
      await softDeleteDispatchDoc(id);

      await load();
    } catch (e) {
      console.error(e);

      alert("Failed to delete.");
    }
  }

  const tableColumns: ColumnConfig[] =
    useMemo(
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
          key: "doc_date",
          label: "Date",
          type: "text",
          disabled: true,
        },

        {
          key: "dr_no",
          label: "Delivery Receipt No.",
          type: "text",
          disabled: true,
        },

        {
          key: "farm_name",
          label: "Farm Name",
          type: "text",
          disabled: true,
        },

        {
          key: "hauler_name",
          label: "Hauler Name",
          type: "text",
          disabled: true,
        },

        {
          key: "hauler_plate_no",
          label: "Plate Number",
          type: "text",
          disabled: true,
        },

        {
          key: "truck_seal_no",
          label: "Truck Seal Number",
          type: "text",
          disabled: true,
        },

        {
          key: "chick_van_temp_c",
          label: "Chick Van Temp",
          type: "text",
          disabled: true,
        },

        {
          key: "number_of_fans",
          label: "Number of Fans",
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
            `/jmb/docdispatchv2/view/${row.id}`,
          );
        },
      },

      {
        label: "Edit",

        disabled: canEdit,

        icon: <Pencil className="w-4 h-4" />,

        onClick: () => {
          router.push(
            `/jmb/docdispatchv2/newv2?id=${row.id}`,
          );
        },
      },

      {
        label: "Print",

        icon: <Printer className="w-4 h-4" />,

        onClick: () => {
          window.open(
            `/jmb/docdispatchv2/${row.id}/print`,
            "_blank",
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
      <Breadcrumb
        SecondPreviewPageName="Hatchery"
        CurrentPageName="DOC Dispatch"
      />

      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading
                  ? "animate-spin"
                  : ""
                }`}
            />

            {loading
              ? "Refreshing..."
              : "Refresh"}
          </Button>
        </div>

        <Button
          type="button"
          className="flex items-center gap-2"
          disabled={canInsert}
          onClick={() =>
            router.push(
              "/jmb/docdispatchv2/newv2",
            )
          }
        >
          <Plus className="h-4 w-4" />

          New Dispatch Doc
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