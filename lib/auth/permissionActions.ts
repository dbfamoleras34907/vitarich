export const PERMISSION_ACTIONS = ["list", "view", "insert", "edit", "void", "approval"] as const

export type PermissionAction = typeof PERMISSION_ACTIONS[number]

const PERMISSION_ACTION_SET = new Set<string>(PERMISSION_ACTIONS)

export function parsePermissionTitle(title: string): {
  moduleTitle: string
  action: PermissionAction
} {
  const slashIndex = title.lastIndexOf("/")
  if (slashIndex < 0) return { moduleTitle: title, action: "list" }

  const suffix = title.slice(slashIndex + 1)
  if (!PERMISSION_ACTION_SET.has(suffix)) {
    return { moduleTitle: title, action: "list" }
  }

  return {
    moduleTitle: title.slice(0, slashIndex),
    action: suffix as PermissionAction,
  }
}
