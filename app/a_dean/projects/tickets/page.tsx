"use client"

import { useEffect, useState } from "react" 

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { getIssuesList } from "./new/api"

export default function IssuesPage() {
  const [issues, setIssues] = useState<any[]>([])
  const [search, setSearch] = useState("")

  async function load() {
    const data = await getIssuesList()
    setIssues(data ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = issues.filter((i) =>
    i.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Issue List</CardTitle>
        </CardHeader>

        <CardContent>
          <Input
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">

          <div className="divide-y">

            {filtered.map((issue) => (
              <div
                key={issue.id}
                className="p-4 hover:bg-muted cursor-pointer"
              >
                <div className="flex justify-between">

                  {/* Left */}
                  <div className="space-y-1">

                    <div className="font-semibold">
                      #{issue.id} — {issue.title}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      Project:{" "}
                      {issue.project?.name ?? "Unassigned"}
                    </div>

                    {/* Assignees */}
                    <div className="text-sm">
                      Assignees:{" "}
                      {issue.assignees.length === 0
                        ? "None"
                        : issue.assignees
                            .map((a: any) => a.user?.email)
                            .join(", ")}
                    </div>

                  </div>

                  {/* Right */}
                  <div className="flex flex-col items-end gap-2">

                    <Badge variant="outline">
                      {issue.status}
                    </Badge>

                    <Badge
                      variant={
                        issue.priority === "urgent"
                          ? "destructive"
                          : issue.priority === "high"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {issue.priority}
                    </Badge>

                  </div>

                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="p-6 text-center text-muted-foreground">
                No issues found
              </div>
            )}

          </div>

        </CardContent>
      </Card>

    </div>
  )
}