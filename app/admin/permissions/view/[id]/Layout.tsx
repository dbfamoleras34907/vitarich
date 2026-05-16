"use client"

import { useEffect, useState } from "react"

import Breadcrumb from "@/lib/Breadcrumb"

import { Button } from "@/components/ui/button"

import { Checkbox } from "@/components/ui/checkbox"

import { Badge } from "@/components/ui/badge"

import {
    getPermissionTemplateById,
    getPermissionTemplateItems,
    updatePermissionTemplate,
} from "./api"

import { NavFolders } from "@/lib/Defaults/DefaultValues"

import { toast } from "sonner"

import { useParams } from "next/navigation"

export default function Layout() {

    const params = useParams()

    const [loading, setLoading] = useState(false)

    const [paramId, setparamId] = useState(0)

    const [templateName, setTemplateName] =
        useState("")

    const [voidValue, setVoidValue] =
        useState(0)

    const [permissions, setPermissions] =
        useState<Record<string, boolean>>({})

    const [pickedRows, setPickedRows] =
        useState<Record<string, any>[]>([])

    const getParamId = () => {

        const id = params.id

        if (!id) return

        const idStr =
            Array.isArray(id)
                ? id[0]
                : id

        setparamId(parseInt(idStr))
    }

    const loadData = async () => {

        try {

            setLoading(true)

            const header =
                await getPermissionTemplateById(paramId)

            const items =
                await getPermissionTemplateItems(paramId)

            console.log({
                header,
                items,
            })

            if (header) {

                setTemplateName(
                    header.template_name
                )

                setVoidValue(
                    header.void
                )
            }

            const mapped:
                Record<string, boolean> = {}

            items.forEach((item: any) => {

                const key =
                    `${item.group_name}|${item.title}`

                mapped[key] =
                    item.is_visible
            })

            console.log({ mapped })

            setPermissions(mapped)

        } catch (error) {

            console.log(error)

            toast.error(
                "Failed to load template"
            )

        } finally {

            setLoading(false)
        }
    }

    const updateTemplate = async () => {

        try {

            await updatePermissionTemplate(
                paramId,
                {
                    template_name: templateName,
                    void: voidValue,
                }
            )

            toast.success(
                "Template updated"
            )

        } catch (error) {

            console.log(error)

            toast.error(
                "Failed to update template"
            )
        }
    }

    useEffect(() => {

        const rows:
            Record<string, any>[] = []

        NavFolders
            .filter((folder) => folder.items)
            .forEach((folder) => {

                folder.items?.forEach((group) => {

                    group.children.forEach((child) => {

                        rows.push({
                            folder: folder.title,
                            group: group.group,
                            title: child.title,
                            type: child.type,
                            url: child.url,
                            insert: child.insert,
                            edit: child.edit,
                            view: child.view,
                        })
                    })
                })
            })

        console.log({ rows })

        setPickedRows(rows)

    }, [])

    useEffect(() => {
        getParamId()
    }, [params])

    useEffect(() => {

        if (!paramId) return

        loadData()

    }, [paramId])

    return (
        <div className="space-y-4 bg-muted/20 min-h-screen p-4">

            <div className="rounded-lg border p-4 bg-white">

                <div className="flex justify-between items-center">

                    <Breadcrumb
                        CurrentPageName="View Permission Template"
                        FirstPreviewsPageName="Permissions"
                    />

                    {/* <Button
                        onClick={updateTemplate}
                        disabled={loading}
                    >
                        Update Template
                    </Button> */}

                </div>

            </div>

            <div className="space-y-4">

                {NavFolders
                    .filter((folder) => folder.items)
                    .map((folder, index) => {

                        const folderRows =
                            pickedRows.filter(
                                (row) =>
                                    row.folder === folder.title
                            )

                        if (
                            folderRows.length === 0
                        ) {
                            return null
                        }

                        return (
                            <div
                                key={index}
                                className="
                                rounded-lg
                                border
                                overflow-hidden
                                bg-white
                            "
                            >

                                <div className="border-b bg-muted/20 px-4 py-3">

                                    <div className="flex items-center justify-between">

                                        <div>

                                            <h2 className="text-base font-semibold">
                                                {folder.title}
                                            </h2>

                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                Permission controls for this module group
                                            </p>

                                        </div>

                                        <Badge
                                            variant="secondary"
                                            className="
                                            rounded-md
                                            px-2
                                            py-0.5
                                            text-[11px]
                                        "
                                        >
                                            {folderRows.length} modules
                                        </Badge>

                                    </div>

                                </div>

                                <div className="overflow-x-auto">

                                    <table className="w-full text-sm">

                                        <thead className="bg-muted/20 border-b">

                                            <tr>

                                                <th className="text-left px-4 py-2 font-medium min-w-70">
                                                    Module
                                                </th>

                                                <th className="text-center px-4 py-2 font-medium">
                                                    List
                                                </th>

                                                <th className="text-center px-4 py-2 font-medium">
                                                    View
                                                </th>

                                                <th className="text-center px-4 py-2 font-medium">
                                                    Insert
                                                </th>

                                                <th className="text-center px-4 py-2 font-medium">
                                                    Edit
                                                </th>

                                            </tr>

                                        </thead>

                                        <tbody>

                                            {folderRows.map(
                                                (row, rowIndex) => (
                                                    <tr
                                                        key={rowIndex}
                                                        className="border-b"
                                                    >

                                                        <td className="px-4 py-2">

                                                            <div className="flex items-center gap-3">

                                                                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-xs">
                                                                    {row.title?.charAt(0)}
                                                                </div>

                                                                <div>

                                                                    <p className="text-sm font-medium">
                                                                        {row.title}
                                                                    </p>

                                                                    <p className="text-[11px] text-muted-foreground">
                                                                        {row.group}
                                                                    </p>

                                                                </div>

                                                            </div>

                                                        </td>

                                                        {/* LIST */}
                                                        <td className="text-center">

                                                            <Checkbox
                                                                disabled
                                                                className="
                                                                    border-2
                                                                    border-black/50
                                                                    data-[state=checked]:bg-primary
                                                                    data-[state=checked]:text-white
                                                                    disabled:opacity-100
                                                                "
                                                                checked={
                                                                    permissions[
                                                                    `${row.group}|${row.title}`
                                                                    ] ?? false
                                                                }
                                                            />

                                                        </td>

                                                        {/* VIEW */}
                                                        <td className="text-center">

                                                            <Checkbox
                                                                disabled={
                                                                    row.view === false
                                                                }
                                                                className="
                                                                    border-2
                                                                    border-black/50
                                                                    data-[state=checked]:bg-primary
                                                                    data-[state=checked]:text-white
                                                                    disabled:opacity-100
                                                                "
                                                                checked={
                                                                    permissions[
                                                                    `${row.group}|${row.title}/view`
                                                                    ] ?? false
                                                                }
                                                            />

                                                        </td>

                                                        {/* INSERT */}
                                                        <td className="text-center">

                                                            <Checkbox
                                                                disabled={
                                                                    row.insert === false
                                                                }
                                                                className="
                                                                    border-2
                                                                    border-black/50
                                                                    data-[state=checked]:bg-primary
                                                                    data-[state=checked]:text-white
                                                                    disabled:opacity-100
                                                                "
                                                                checked={
                                                                    permissions[
                                                                    `${row.group}|${row.title}/insert`
                                                                    ] ?? false
                                                                }
                                                            />

                                                        </td>

                                                        {/* EDIT */}
                                                        <td className="text-center">

                                                            <Checkbox
                                                                disabled={
                                                                    row.edit === false
                                                                }
                                                                className="
                                                                    border-2
                                                                    border-black/50
                                                                    data-[state=checked]:bg-primary
                                                                    data-[state=checked]:text-white
                                                                    disabled:opacity-100
                                                                "
                                                                checked={
                                                                    permissions[
                                                                    `${row.group}|${row.title}/edit`
                                                                    ] ?? false
                                                                }
                                                            />

                                                        </td>

                                                    </tr>
                                                )
                                            )}

                                        </tbody>

                                    </table>

                                </div>

                            </div>
                        )
                    })}
            </div>

        </div>
    )
}