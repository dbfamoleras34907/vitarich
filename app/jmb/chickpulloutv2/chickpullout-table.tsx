"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  RefreshCw,
} from "lucide-react";

import {
  ChickPulloutProcess,
  listChickPulloutProcess,
} from "./newv2/api";

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

import { usePermission } from "@/hooks/usePermission";

import { useGlobalContext } from "@/lib/context/GlobalContext";

export default function ChickPulloutTable() {
  const router = useRouter();

  const [items, setItems] = useState<RowDataKey[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const { setValue } = useGlobalContext();

  const canView = usePermission(
    "/jmb/chickpulloutv2/view",
  );

  const canInsert = usePermission(
    "/jmb/chickpulloutv2/insert",
  );

  const canEdit = usePermission(
    "/jmb/chickpulloutv2/edit",
  );

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await listChickPulloutProcess();

      const mapped =
        Array.isArray(data)
          ? data.map(
              (
                item: ChickPulloutProcess,
                index: number,
              ) => ({
                id: item.id,

                "#": index + 1,

                egg_ref_no:
                  item.egg_ref_no || "-",

                machine_no:
                  item.machine_no || "-",

                hatch_date:
                  item.hatch_date || "-",

                chicks_hatched:
                  item.chicks_hatched || "-",

                dead_in_shell:
                  item.dead_in_shell || "-",

                hatch_fertile:
                  item.hatch_fertile || "-",

                mortality_rate:
                  item.mortality_rate || "-",

                hatch_window:
                  item.hatch_window || "-",
              }),
            )
          : [];

      setItems(mapped);
    } catch (e) {
      console.error(e);

      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSessionx(router);
  }, []);

  useEffect(() => {
    router.prefetch("/jmb/chickpulloutv2/newv2");

    load();
  }, [router, load]);

  useEffect(() => {
    setValue("loading_g", isLoading);
  }, [isLoading]);

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
        key: "machine_no",
        label: "Machine",
        type: "text",
        disabled: true,
      },

      {
        key: "hatch_date",
        label: "Hatch Date",
        type: "text",
        disabled: true,
      },

      {
        key: "chicks_hatched",
        label: "Chicks Hatched",
        type: "text",
        disabled: true,
      },

      {
        key: "dead_in_shell",
        label: "Dead-in-shell",
        type: "text",
        disabled: true,
      },

      {
        key: "hatch_fertile",
        label: "Hatch of Fertile (%)",
        type: "text",
        disabled: true,
      },

      {
        key: "mortality_rate",
        label: "Mortality Rate (%)",
        type: "text",
        disabled: true,
      },

      {
        key: "hatch_window",
        label: "Hatch Window",
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

        icon: <FileSearch className="w-4 h-4" />,

        disabled: canView,

        onClick: () => {
          router.push(
            `/jmb/chickpulloutv2/view/${row.id}`,
          );
        },
      },

      {
        label: "Edit",

        disabled: canEdit,

        icon: <Pencil className="w-4 h-4" />,

        onClick: () => {
          router.push(
            `/jmb/chickpulloutv2/newv2?id=${row.id}`,
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
        CurrentPageName="Chick Pullout"
      />

      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={load}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`size-4 ${
                isLoading
                  ? "animate-spin"
                  : ""
              }`}
            />

            {isLoading
              ? "Refreshing..."
              : "Refresh"}
          </Button>
        </div>

        <Button
          type="button"
          onClick={() =>
            router.push(
              "/jmb/chickpulloutv2/newv2",
            )
          }
          disabled={canInsert}
          className="flex items-center gap-2"
        >
          <Plus className="size-4" />

          New Chick Pullout
        </Button>
      </div>

      <div className="mt-4">
        <DynamicTable
          loading={isLoading}
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