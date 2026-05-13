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
  ChickGradingProcess,
  listChickGradingProcess,
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

function fmtDateTime(
  v: string | null | undefined,
) {
  if (!v) return "-";

  const d = new Date(v);

  if (Number.isNaN(d.getTime())) return "-";

  const pad = (n: number) =>
    String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(
    d.getMonth() + 1,
  )}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function ChickgradingTable() {
  const router = useRouter();

  const [items, setItems] = useState<RowDataKey[]>(
    [],
  );

  const [isLoading, setIsLoading] =
    useState(false);

  const { setValue } = useGlobalContext();

  const canView = usePermission(
    "/jmb/docclassification/view",
  );

  const canInsert = usePermission(
    "/jmb/docclassification/insert",
  );

  const canEdit = usePermission(
    "/jmb/docclassification/edit",
  );

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      const data =
        await listChickGradingProcess();

      const mapped =
        Array.isArray(data)
          ? data.map(
              (
                item: ChickGradingProcess,
                index: number,
              ) => ({
                id: item.id,

                "#": index + 1,

                egg_ref_no:
                  item.egg_ref_no || "-",

                batch_code:
                  item.batch_code || "-",

                grading_datetime:
                  fmtDateTime(
                    item.grading_datetime,
                  ),

                total_chicks:
                  Number(
                    item.total_chicks || 0,
                  ).toLocaleString(),

                good_quality_chicks:
                  Number(
                    item.good_quality_chicks ||
                      0,
                  ).toLocaleString(),

                quality_grade_rate:
                  item.quality_grade_rate ||
                  "-",

                cull_rate:
                  item.cull_rate || "-",

                grading_personnel:
                  item.grading_personnel ||
                  "-",
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
    router.prefetch(
      "/jmb/docclassification/newv2",
    );

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
        key: "batch_code",
        label: "Batch Code",
        type: "text",
        disabled: true,
      },

      {
        key: "grading_datetime",
        label: "Grading Date & Time",
        type: "text",
        disabled: true,
      },

      {
        key: "total_chicks",
        label: "Total Egg Set",
        type: "text",
        disabled: true,
      },

      {
        key: "good_quality_chicks",
        label: "Good Quality Chicks",
        type: "text",
        disabled: true,
      },

      {
        key: "quality_grade_rate",
        label: "Quality Grade Rate %",
        type: "text",
        disabled: true,
      },

      {
        key: "cull_rate",
        label: "Cull Rate %",
        type: "text",
        disabled: true,
      },

      {
        key: "grading_personnel",
        label: "Grading Personnel",
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
            `/jmb/docclassification/view/${row.id}`,
          );
        },
      },

      {
        label: "Edit",

        disabled: canEdit,

        icon: <Pencil className="w-4 h-4" />,

        onClick: () => {
          router.push(
            `/jmb/docclassification/newv2?id=${row.id}`,
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
        CurrentPageName="Doc Classification"
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
              "/jmb/docclassification/newv2",
            )
          }
          disabled={canInsert}
          className="flex items-center gap-2"
        >
          <Plus className="size-4" />

          New DOC Classification
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