'use client'
import DataTable from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { NavFolders } from '@/lib/Defaults/DefaultValues'
import { DataTableColumn } from '@/lib/types'
import React, { useEffect, useState } from 'react'
import { getUserPermissions, toggleUserPermission } from './api'
import { Badge } from '@/components/ui/badge'
import SearchableDropdown from '@/lib/SearchableDropdown'
import { Checkbox } from '@/components/ui/checkbox'
interface RuleAndPermProps {
    userId: string;
}
export default function Permesions({ userId }: RuleAndPermProps) {
    const [pickedRows, setPickedRows] = useState<Record<string, any>[]>([])
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});


    const loadpermissions = async () => {
        try {
            async function loadPermissions() {
                if (!userId) return;
                const data = await getUserPermissions(userId);

                const mapped: Record<string, boolean> = {};
                data.forEach((item) => {
                    const key = `${item.group_name}|${item.title}`;
                    mapped[key] = item.is_visible;
                });
                setPermissions(mapped);
            }

            loadPermissions();
        } catch (error) {
            console.log({ error });
        }
    }
    const EnabledonCheckChange = async (
        groupName: string,
        title: string,
        newChecked: boolean,
        url: string,
        type: string,
    ) => {
        const key = `${groupName}|${title}`
        setPermissions((prev) => ({
            ...prev,
            [key]: newChecked,
        }))

        try {
            console.log({ userId, groupName, title, newChecked, url, type })
            await toggleUserPermission(userId, groupName, title, newChecked, url, type)
        } catch (error) {
            setPermissions((prev) => ({
                ...prev,
                [key]: !newChecked,
            }))

            console.log(error)
        }
    }
    const components: DataTableColumn[] = [
        { code: "title", name: "Module", type: "text", },
        {
            code: "enabled",
            name: "List",
            type: "checkbox",
            render: (row) => (
                <div className='mx-auto w-fit'>
                    <Checkbox className='border-2 border-black/50 rounded'
                        checked={permissions[`${row.group}|${row.title}`] ?? false}

                        onCheckedChange={(e) => EnabledonCheckChange(row.group, row.title, e ? true : false, row.url, 'list')
                        }
                    />
                </div>
            )

        },
        {
            code: "view",
            name: "View",
            type: "checkbox",
            render: (row) => (
                <div className='mx-auto w-fit'>
                    <Checkbox className='border-2 border-black/50 rounded'
                        checked={permissions[`${row.group}|${row.title}/view`] ?? false}

                        onCheckedChange={(e) => EnabledonCheckChange(row.group, `${row.title}/view`, e ? true : false, `${row.url}/view`, 'view')
                        }
                    />
                </div>
            )

        },
        {
            code: "insert",
            name: "Insert",
            type: "checkbox",
            render: (row) => (
                <div className='mx-auto w-fit'>
                    <Checkbox className='border-2 border-black/50 rounded'
                        checked={permissions[`${row.group}|${row.title}/insert`] ?? false}

                        onCheckedChange={(e) => EnabledonCheckChange(row.group, `${row.title}/insert`, e ? true : false, `${row.url}/insert`, 'insert')
                        }
                    />
                </div>
            )

        },
        {
            code: "edit",
            name: "Edit",
            type: "checkbox",
            render: (row) => (
                <div className='mx-auto w-fit'>
                    <Checkbox className='border-2 border-black/50 rounded'
                        checked={permissions[`${row.group}|${row.title}/edit`] ?? false}

                        onCheckedChange={(e) => EnabledonCheckChange(row.group, `${row.title}/edit`, e ? true : false, `${row.url}/edit`, 'edit')
                        }
                    />
                </div>
            )

        },
    ]




    useEffect(() => {
        const rows: Record<string, any>[] = []

        NavFolders.filter((folder) => folder.items).forEach((folder) => {
            folder.items?.forEach((group) => {
                group.children.forEach((child) => {
                    const key = `${group.group}|${child.title}`
                    const defaultValue = permissions[key] ?? false
                    // console.log({ group })
                    rows.push({
                        folder: folder.title,
                        group: group.group,
                        title: child.title,
                        type: child.type,
                        url: child.url,
                        checked: defaultValue,
                        insert: child.insert,
                        edit: child.edit,
                        view: child.view
                    })
                })
            })
        })

        setPickedRows(rows)
    }, [NavFolders, permissions])
    useEffect(() => {
        loadpermissions()
    }, [])

    // return (
    //     <>

    //         <div className="rounded-2xl bg-white p-4 mb-4">
    //             <p className='font-semibold'>Template</p>
    //             <SearchableDropdown
    //                 codeLabel='code'
    //                 nameLabel='code'
    //                 list={[
    //                     { code: "", name: "" }
    //                 ]}
    //                 onChange={() => { }}

    //             />
    //             <Button onClick={() => console.log({ permissions })}>Check</Button>
    //         </div>
    //         <div className="rounded-2xl bg-white">
    //             {NavFolders.filter((folder) => folder.items).map((folder, index) => {
    //                 const folderRows = pickedRows.filter(
    //                     (row) => row.folder === folder.title
    //                 )

    //                 if (folderRows.length === 0) return null

    //                 return (
    //                     <div key={index} className=" p-4  shadow-sm">
    //                         <div className="mb-4 flex items-center gap-2">
    //                             <h2 className="text-2xl font-bold">
    //                                 {folder.title}
    //                             </h2>
    //                             <Badge variant={"secondary"} className='mt-1'> {folderRows.length} modules </Badge>
    //                         </div>

    //                         <DataTable
    //                             columns={components}
    //                             rows={folderRows}
    //                             setRowsAction={(updatedRows) => {
    //                                 setPickedRows((prev) => {
    //                                     const otherRows = prev.filter(
    //                                         (r) => r.folder !== folder.title
    //                                     )
    //                                     const resolvedRows =
    //                                         typeof updatedRows === "function"
    //                                             ? updatedRows(
    //                                                 prev.filter(
    //                                                     (r) => r.folder === folder.title
    //                                                 )
    //                                             )
    //                                             : updatedRows

    //                                     return [...otherRows, ...resolvedRows]
    //                                 })
    //                             }}
    //                             isfit
    //                         />
    //                     </div>
    //                 )
    //             })}
    //         </div>
    //     </>
    // )


    return (
        <div className="space-y-4 bg-muted/20 min-h-screen p-4">

            {/* Top Bar */}
            <div className="rounded-lg border  p-4 bg-white">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

                    <div className="space-y-3 w-full max-w-sm">
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight">
                                User Permissions
                            </h1>

                            <p className="text-sm text-muted-foreground">
                                Manage access permissions per module
                            </p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium">
                                Template
                            </label>

                            <SearchableDropdown
                                codeLabel='code'
                                nameLabel='code'
                                list={[
                                    { code: "", name: "" }
                                ]}
                                onChange={() => { }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            className="rounded-md"
                            onClick={() => console.log({ permissions })}
                        >
                            Debug
                        </Button>

                        <Button className="rounded-md">
                            Save Permissions
                        </Button>
                    </div>
                </div>
            </div>

            {/* Groups */}
            <div className="space-y-4">

                {NavFolders.filter((folder) => folder.items).map((folder, index) => {

                    const folderRows = pickedRows.filter(
                        (row) => row.folder === folder.title
                    )

                    if (folderRows.length === 0) return null

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

                            {/* Header */}
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
                                        px-2 py-0.5
                                        text-[11px]
                                        font-medium
                                    "
                                    >
                                        {folderRows.length} modules
                                    </Badge>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">

                                <table className="w-full text-sm">

                                    <thead className="bg-muted/20 border-b">
                                        <tr>

                                            <th className="text-left px-4 py-2 font-medium min-w-70">
                                                Module
                                            </th>

                                            <th className="text-center px-4 py-2 font-medium w-22.5">
                                                List
                                            </th>

                                            <th className="text-center px-4 py-2 font-medium w-22.5">
                                                View
                                            </th>

                                            <th className="text-center px-4 py-2 font-medium w-22.5">
                                                Insert
                                            </th>

                                            <th className="text-center px-4 py-2 font-medium w-22.5">
                                                Edit
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {folderRows.map((row, rowIndex) => (
                                            <tr
                                                key={rowIndex}
                                                className="
                                                border-b
                                                hover:bg-muted/50
                                                transition-colors
                                            "
                                            >

                                                {/* Module */}
                                                <td className="px-4 py-2">

                                                    <div className="flex items-center gap-3">

                                                        <div
                                                            className="
                                                            h-8 w-8
                                                            rounded-md
                                                            bg-muted
                                                            flex
                                                            items-center
                                                            justify-center
                                                            text-xs
                                                            font-medium
                                                            text-muted-foreground
                                                        "
                                                        >
                                                            {row.title?.charAt(0)}
                                                        </div>

                                                        <div>
                                                            <p className="text-sm font-medium leading-none">
                                                                {row.title}
                                                            </p>

                                                            <p className="text-[11px] text-muted-foreground mt-1">
                                                                {row.group}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* List */}
                                                <td className="px-4 py-2 text-center">
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            className='h-4 w-4 rounded-lg border-2 border-black/50'
                                                            checked={permissions[`${row.group}|${row.title}`] ?? false}
                                                            onCheckedChange={(e) =>
                                                                EnabledonCheckChange(
                                                                    row.group,
                                                                    row.title,
                                                                    e ? true : false,
                                                                    row.url,
                                                                    'list'
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </td>

                                                {/* View */}
                                                <td className="px-4 py-2 text-center">
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            className='h-4 w-4 rounded-lg border-2 border-black/50'
                                                            disabled={!row.view}
                                                            checked={permissions[`${row.group}|${row.title}/view`] ?? false}
                                                            onCheckedChange={(e) =>
                                                                EnabledonCheckChange(
                                                                    row.group,
                                                                    `${row.title}/view`,
                                                                    e ? true : false,
                                                                    `${row.url}/view`,
                                                                    'view'
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </td>

                                                {/* Insert */}
                                                <td className="px-4 py-2 text-center">
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            className='h-4 w-4 rounded-lg border-2 border-black/50'
                                                            disabled={!row.insert}

                                                            checked={permissions[`${row.group}|${row.title}/insert`] ?? false}
                                                            onCheckedChange={(e) =>
                                                                EnabledonCheckChange(
                                                                    row.group,
                                                                    `${row.title}/insert`,
                                                                    e ? true : false,
                                                                    `${row.url}/insert`,
                                                                    'insert'
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </td>

                                                {/* Edit */}
                                                <td className="px-4 py-2 text-center">
                                                    <div className="flex justify-center">
                                                        <Checkbox
                                                            disabled={!row.edit}

                                                            className='h-4 w-4 rounded-lg border-2 border-black/50'
                                                            checked={permissions[`${row.group}|${row.title}/edit`] ?? false}
                                                            onCheckedChange={(e) =>
                                                                EnabledonCheckChange(
                                                                    row.group,
                                                                    `${row.title}/edit`,
                                                                    e ? true : false,
                                                                    `${row.url}/edit`,
                                                                    'edit'
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </td>

                                            </tr>
                                        ))}
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
// how about we use shadcn tabs instead