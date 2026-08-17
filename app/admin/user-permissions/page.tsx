export const dynamic = "force-dynamic"

import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import { NavFolders } from "@/lib/Defaults/DefaultValues"
import Layout from "./Layout"
import type { PermissionAction, PermissionFolder } from "./api"

const permissionActions: PermissionAction[] = ["list", "view", "insert", "edit", "void", "approval"]

const permissionFolders: PermissionFolder[] = NavFolders.map(folder => ({
  id: folder.id,
  title: folder.title,
  fmsTypes: folder.fmsTypes,
  rows: (folder.items ?? []).flatMap(group => group.children.map(child => ({
    group: group.group,
    title: child.title,
    actions: permissionActions.filter(action => action === "list" || Boolean(child[action])),
  }))),
}))

export default function Page() {
  return <NavigationBar currentLabel="User Permissions" fatherLabel="Administrator" fatherLink="/admin/user">
    <Layout permissionFolders={permissionFolders} />
  </NavigationBar>
}
