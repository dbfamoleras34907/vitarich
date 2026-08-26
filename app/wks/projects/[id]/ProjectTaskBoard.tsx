'use client'

import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { usePermission } from '@/hooks/usePermission'
import { moveWorkspaceTask } from '@/lib/data/mutations/workspace'
import type { WorkspaceTask, WorkspaceTaskStatus } from '@/lib/data/repositories/workspace'

export default function ProjectTaskBoard({
  tasks,
  statuses,
  onTasksChange,
}: {
  tasks: WorkspaceTask[]
  statuses: WorkspaceTaskStatus[]
  onTasksChange: (tasks: WorkspaceTask[]) => void
}) {
  const router = useRouter()
  const editDenied = usePermission('/wks/tasks/edit')

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || editDenied) return
    const taskId = Number(result.draggableId)
    const statusId = Number(result.destination.droppableId)
    const originalTasks = tasks
    const task = tasks.find(item => item.id === taskId)
    if (!task || task.status_id === statusId) return

    onTasksChange(tasks.map(item => item.id === taskId ? { ...item, status_id: statusId } : item))
    try {
      await moveWorkspaceTask(taskId, statusId)
      toast.success(`Task moved to ${statuses.find(status => status.id === statusId)?.name || 'the selected status'}`)
    } catch (error) {
      onTasksChange(originalTasks)
      toast.error(error instanceof Error ? error.message : 'Unable to move task')
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {statuses.map(status => {
          const columnTasks = tasks.filter(task => task.status_id === status.id)
          return (
            <section key={status.id} className="w-72 shrink-0 rounded-lg border bg-muted/30">
              <header className="flex items-center justify-between border-b px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                  {status.name}
                </span>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">{columnTasks.length}</span>
              </header>
              <Droppable droppableId={String(status.id)}>
                {provided => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-32 space-y-2 p-2">
                    {columnTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={String(task.id)} index={index} isDragDisabled={editDenied}>
                        {providedTask => (
                          <Card
                            ref={providedTask.innerRef}
                            {...providedTask.draggableProps}
                            {...providedTask.dragHandleProps}
                            className="cursor-pointer p-3 shadow-none hover:border-primary/40"
                            onClick={() => router.push(`/wks/tasks/${task.id}`)}
                          >
                            <p className="text-sm font-medium">{task.subject}</p>
                            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                              <span>{task.priority === 'mid' ? 'Medium' : task.priority || 'No priority'}</span>
                              <span>#{task.id}</span>
                            </div>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {columnTasks.length === 0 && (
                      <div className="rounded-md border border-dashed p-5 text-center text-xs text-muted-foreground">Drop tasks here</div>
                    )}
                  </div>
                )}
              </Droppable>
            </section>
          )
        })}
      </div>
    </DragDropContext>
  )
}
