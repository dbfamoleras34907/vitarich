"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { db } from "@/lib/Supabase/supabaseClient"
import { ColumnConfig, RowDataKey } from "@/lib/Defaults/DefaultTypes"
import DynamicTable from "@/components/ui/DataTableV2"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { HandCoins } from "lucide-react"
import SearchableDropdown from "@/lib/SearchableDropdown"
import { ISSUE_PRIORITIES } from "@/lib/Defaults/DefaultValues"
import { Modal } from "@/lib/Moda"








export default function ProjectTicketsPage() {
  const [openModal, setOpenModal] = useState(false);


  const receivedColumns: ColumnConfig[] = [
    { key: 'id', label: 'ID', type: 'text', disabled: true },
    { key: 'title', label: 'Work', type: 'text', disabled: true }, // FIXED
    { key: 'assignee', label: 'Assignee', type: 'text', },
    { key: 'priority', label: 'Priority', type: 'search', disabled: true, data: ISSUE_PRIORITIES, codeKey: "code", nameKey: "name" },
    { key: 'status', label: 'Status', type: 'text', disabled: true },
    { key: 'created_at', label: 'Created', type: 'date', disabled: true },
    { key: 'updated_at', label: 'Updated', type: 'date', disabled: true },
    { key: 'due_at', label: 'Due Date', type: 'date', disabled: true },
    { key: 'action', label: 'Action', type: 'button', disabled: true },
  ]

  const [receivedRows, setReceivedRows] = useState<RowDataKey[]>([])

  const { projectId } = useParams()
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function loadIssues() {
    setLoading(true)

    const { data, error } = await db
      .from("dmfvw_get_issue_w_proj")
      .select("*")
      .eq("project_id", decodeURIComponent(projectId as string))
      .order("id", { ascending: false })
    console.log({ data })
    if (error) {
      console.error(error)
      alert("Failed to load tickets")
    } else {
      setIssues(data ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (projectId) loadIssues()
  }, [projectId])

  if (loading) return <div className="p-6">Loading tickets...</div>

  return (
    <div className="p-6 space-y-4">

      <div className="flex justify-between px-4">
        <h1 className="text-2xl font-bold">
          Project Tickets — Project #{projectId}
        </h1>
        <Button onClick={() => setOpenModal(true)}>test</Button>
      </div>


      {issues.length === 0 && (
        <div>No tickets found for this project</div>
      )}
      <DynamicTable
      loading={loading}
        initialFilters={[]}
        columns={receivedColumns.map((col) => ({
          key: col.key,
          label: col.label,
          align: "left",
          type: col.type,
          render: (row: RowDataKey) => {
            if (col.type === 'button') {
              return (
                <div className="flex justify-center gap-2">
                  <Button
                    className='bg-background border hover:bg-foreground/10 border-green-400 text-green-400 p-1 rounded-xs   '
                    onClick={() => {
                      toast.warning(
                        "Only pending documents are allowed to be edited on this module"
                      )
                    }}
                  >
                    <HandCoins />
                    Receive
                  </Button>
                </div>
              )
            }

            if (col.type === "search") {
              return (
                <SearchableDropdown
                  list={col.data ?? []}
                  codeLabel={col.codeKey ?? ""}
                  nameLabel={col.nameKey ?? ""}
                  showNameOnly
                  // value={item.sku}
                  value={row[col.key]}
                  onChange={(val, selected) =>
                    // updateItem(item.id, {
                    //   sku: val,
                    //   UoM: selected.unit_measure || 'PCS'
                    // })
                    console.log({ val, selected })
                  }
                />
              )
            }

            // 📝 Default rendering
            const value = row[col.key]

            if (!value) return "-"

            return String(value)
          },
        }))}

        data={issues}
      />
      <Modal
        open={openModal}
        onOpenChange={setOpenModal}
        title="Select Theme"
        description="Choose your preferred interface style."
        className="max-w-md w-full  "
      >
        test
      </Modal>
    </div>
  )
}