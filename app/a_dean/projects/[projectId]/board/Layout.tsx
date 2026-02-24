"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { db } from "@/lib/Supabase/supabaseClient"

import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from "@hello-pangea/dnd"

const STATUSES = ["backlog", "todo", "doing", "done"]

export default function ProjectBoardPage() {
  const { projectId } = useParams()
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // ✅ Load issues
  async function loadIssues() {
    setLoading(true)

    const { data, error } = await db
      .from("issues")
      .select("*")
      .eq("project_id", projectId)
      .order("id", { ascending: false })
    console.log({ data })

    if (error) console.error(error)
    else setIssues(data ?? [])
    console.log({ data })
    setLoading(false)
  }

  useEffect(() => {
    if (projectId) loadIssues()
  }, [projectId])

  // ✅ Realtime updates
  useEffect(() => {
    const channel = db
      .channel("issues-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "issues" },
        () => loadIssues()
      )
      .subscribe()

    return () => {
      db.removeChannel(channel)
    }
  }, [projectId])

  // ✅ Drag handler
  async function onDragEnd(result: DropResult) {
    if (!result.destination) return

    const issueId = result.draggableId
    const newStatus = result.destination.droppableId

    // Optimistic update
    setIssues((prev) =>
      prev.map((i) =>
        String(i.id) === issueId ? { ...i, status: newStatus } : i
      )
    )

    // Update DB
    const { error } = await db
      .from("issues")
      .update({ status: newStatus })
      .eq("id", issueId)

    if (error) console.error(error)
  }

  if (loading) return <div className="p-6">Loading board...</div>

  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-6">
        Project Board — Project #{projectId}
      </h1>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto">

          {STATUSES.map((status) => {
            const columnIssues = issues.filter(
              (i) => i.status === status
            )

            return (
              <div
                key={status}
                className="w-80 bg-muted rounded-lg p-3 shrink-0"
              >
                <div className="font-semibold mb-3">
                  {status} ({columnIssues.length})
                </div>

                <Droppable droppableId={status}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-3 min-h-25"
                    >
                      {columnIssues.map((issue, index) => (
                        <Draggable
                          key={issue.id}
                          draggableId={String(issue.id)}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="bg-white rounded shadow p-3 border hover:bg-gray-50"
                            >
                              <div className="font-medium">
                                #{issue.id} — {issue.title}
                              </div>

                              <div className="text-sm text-muted-foreground mt-1">
                                Priority: {issue.priority ?? "—"}
                              </div>

                              {issue.assignee && (
                                <div className="text-xs mt-1">
                                  👤 {issue.assignee}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}

                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}

        </div>
      </DragDropContext>

    </div>
  )
}