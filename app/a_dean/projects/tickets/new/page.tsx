// app/a_dean/projects/tickets/new/page.tsx

"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from "@/components/ui/card"
import { db } from "@/lib/Supabase/supabaseClient"
import { createIssue, getProjectsForSelect } from "./api"

export default function CreateIssuePage() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("medium")
  const [projectId, setProjectId] = useState<number | null>(null)
  const [assignees, setAssignees] = useState<string[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

  // Load projects + users
  useEffect(() => {
    async function load() {
      const proj = await getProjectsForSelect()
      setProjects(proj ?? [])

      const { data: userList } = await db.auth.admin.listUsers()
      setUsers(userList?.users ?? [])
    }

    load()
  }, [])

  function toggleAssignee(userId: string) {
    setAssignees((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  async function handleCreate() {
    if (!title.trim()) return alert("Title required")

    const {
      data: { user }
    } = await db.auth.getUser()

    if (!user) return alert("Not authenticated")

    await createIssue({
      title,
      description,
      project_id: projectId,
      priority,
      assignees,
      userId: user.id
    })

    alert("Issue created")

    setTitle("")
    setDescription("")
    setProjectId(null)
    setPriority("medium")
    setAssignees([])
  }

  return (
    <div className="p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Create Issue / Ticket</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* Title */}
          <Input
            placeholder="Issue title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* Description */}
          <Textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* Project (optional) */}
          <div>
            <label className="text-sm font-medium">
              Project (optional)
            </label>

            <select
              className="w-full border rounded p-2"
              value={projectId ?? ""}
              onChange={(e) =>
                setProjectId(
                  e.target.value ? Number(e.target.value) : null
                )
              }
            >
              <option value="">Unassigned Project</option>

              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm font-medium">
              Priority
            </label>

            <select
              className="w-full border rounded p-2"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Assignees */}
          <div>
            <label className="text-sm font-medium">
              Assignees
            </label>

            <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1">
              {users.map((u: any) => (
                <label key={u.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={assignees.includes(u.id)}
                    onChange={() => toggleAssignee(u.id)}
                  />
                  {u.email}
                </label>
              ))}
            </div>
          </div>

          <Button onClick={handleCreate}>
            Create Issue
          </Button>

        </CardContent>
      </Card>
    </div>
  )
}