import { NavFolders } from "@/lib/Defaults/DefaultValues"
import type { PermissionAction, PermissionFolder } from "./api"

const permissionActions: PermissionAction[] = ["list", "view", "insert", "edit", "void", "approval"]

export const permissionFolders: PermissionFolder[] = NavFolders.map(folder => ({
  id: folder.id,
  title: folder.title,
  fmsTypes: folder.fmsTypes,
  rows: (folder.items ?? []).flatMap(group => group.children.map(child => ({
    group: group.group,
    title: child.title,
    actions: permissionActions.filter(action => action === "list" || Boolean(child[action])),
  }))),
}))

