"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import Breadcrumb from "@/lib/Breadcrumb"

import DynamicTable from "@/components/ui/DataTableV2"

import { Button } from "@/components/ui/button"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
    MoreHorizontal,
    Pencil,
    RefreshCw,
    EyeOff,
    Eye,
    FileSearch,
} from "lucide-react"

import {
    listPermissionTemplates,
    PermissionTemplate,
    voidPermissionTemplate,
} from "./api"

import { ColumnConfig, RowDataKey } from "@/lib/Defaults/DefaultTypes"

import { RowAction } from "@/lib/types"

import { toast } from "sonner"

export default function Layout() {

    const router = useRouter()

    const [items, setItems] = useState<RowDataKey[]>([])
    const [loading, setLoading] = useState(false)

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
                key: "template_name",
                label: "Template Name",
                type: "text",
                disabled: true,
            },

            {
                key: "remarks",
                label: "Remarks",
                type: "text",
                disabled: true,
            },

            {
                key: "status",
                label: "Status",
                type: "text",
                disabled: true,
            },

            {
                key: "created_at",
                label: "Created At",
                type: "text",
                disabled: true,
            },
        ],
        []
    )

    const fetchItems = async () => {

        try {

            setLoading(true)

            const data = await listPermissionTemplates()

            const mapped = data.map(
                (item: PermissionTemplate, index: number) => ({
                    id: item.id,

                    "#": index + 1,

                    template_name: item.template_name,

                    remarks: item.remarks || "-",

                    status:
                        item.void == 0
                            ? "Inactive"
                            : "Active",

                    created_at:
                        new Date(
                            item.created_at
                        ).toLocaleString(),
                })
            )

            setItems(mapped)

        } catch (error) {

            console.log(error)

            setItems([])

        } finally {

            setLoading(false)
        }
    }

    useEffect(() => {
        fetchItems()
    }, [])

    const toggleVoid = async (
        row: RowDataKey,
        value: number
    ) => {

        try {

            await voidPermissionTemplate(
                row.id,
                value
            )

            toast.success(
                value === 1
                    ? "Template inactivated"
                    : "Template activated"
            )

            fetchItems()

        } catch (error) {

            console.log(error)

            toast.error("Failed to update template")
        }
    }

    const getRowActions = (
        row: RowDataKey
    ): RowAction[] => {

        return [

            {
                label: "View",
                icon: <FileSearch className="w-4 h-4" />,
                onClick: () => {
                    router.push(
                        `/admin/permissions/view/${row.id}`
                    )
                },
            },

            {
                label:
                    row.status === "Active"
                        ? "Set Inactive"
                        : "Set Active",

                icon:
                    row.status === "Active"
                        ? <EyeOff className="w-4 h-4" />
                        : <Eye className="w-4 h-4" />,

                onClick: () => {

                    toggleVoid(
                        row,
                        row.status === "Active"
                            ? 0
                            : 1
                    )
                },
            },
        ]
    }

    return (
        <div className="rounded-md p-4 mt-4">

            <div className="flex justify-between items-center">

                <Breadcrumb
                    CurrentPageName="Permission Templates"
                    FirstPreviewsPageName="Admin"
                />

                <Button
                    variant="outline"
                    onClick={fetchItems}
                    disabled={loading}
                >
                    <RefreshCw className="w-4 h-4" />

                    {loading
                        ? "Loading..."
                        : "Refresh"}
                </Button>

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

                        render: (
                            row: RowDataKey
                        ) => {

                            if (col.key === "action") {

                                const actions =
                                    getRowActions(row)

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
                                                        onClick={() =>
                                                            action.onClick(row)
                                                        }
                                                        className="cursor-pointer flex items-center gap-2"
                                                    >
                                                        {action.icon}
                                                        {action.label}
                                                    </DropdownMenuItem>
                                                )
                                            )}

                                        </DropdownMenuContent>

                                    </DropdownMenu>
                                )
                            }

                            return row[col.key] || "-"
                        },
                    }))}
                />

            </div>

        </div>
    )
}