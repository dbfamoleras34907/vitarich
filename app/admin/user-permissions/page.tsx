export const dynamic = "force-dynamic"

import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import { permissionFolders } from "./permissionFolders"
import Layout from "./Layout"

export default async function Page({ searchParams }: { searchParams: Promise<{ user?: string | string[] }> }) {
  const { user } = await searchParams
  return <NavigationBar currentLabel="User Permissions" fatherLabel="Administrator" fatherLink="/admin/user">
    <Layout permissionFolders={permissionFolders} requestedUserId={typeof user === "string" ? user : ""} />
  </NavigationBar>
}
