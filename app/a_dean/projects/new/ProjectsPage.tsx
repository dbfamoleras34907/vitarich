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
import { createProject, getActiveProjects, Project, updateProject, voidProject } from "./api"
import { db } from "@/lib/Supabase/supabaseClient"

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)

  async function loadProjects() {
    const data = await getActiveProjects()
    setProjects(data)
  }

  useEffect(() => {
    loadProjects()
  }, [])

  async function handleSubmit() {
    if (!name.trim()) return alert("Project name required")

    const {
      data: { user }
    } = await db.auth.getUser()

    if (!user) return alert("Not authenticated")

    if (editingId) {
      await updateProject(editingId, name, description)
    } else {
      await createProject(name, description, user.id)
    }

    setName("")
    setDescription("")
    setEditingId(null)

    await loadProjects()
  }

  function startEdit(project: Project) {
    setEditingId(project.id)
    setName(project.name)
    setDescription(project.description ?? "")
  }

  async function handleVoid(id: number) {
    if (!confirm("Deactivate this project?")) return
    await voidProject(id)
    await loadProjects()
  }

  return (
    <div className="p-6 space-y-6">

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>
            {editingId ? "Edit Project" : "Create Project"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Button onClick={handleSubmit}>
            {editingId ? "Update Project" : "Create Project"}
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Projects</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex justify-between items-center border p-3 rounded"
            >
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-muted-foreground">
                  {p.description}
                </div>
              </div>

              <div className="space-x-2">
                <Button
                  variant="outline"
                  onClick={() => startEdit(p)}
                >
                  Edit
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => handleVoid(p.id)}
                >
                  Void
                </Button>
              </div>
            </div>
          ))}

          {projects.length === 0 && (
            <div className="text-muted-foreground">
              No active projects
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}