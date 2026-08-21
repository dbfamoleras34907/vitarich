export const dynamic = "force-dynamic"

import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import { notificationCatalog } from "@/lib/notifications/catalog"
import Layout from "./Layout"

export default function Page() {
  return (
    <NavigationBar currentLabel="Notification Setup" fatherLabel="Administrator" fatherLink="/admin/user">
      <Layout catalog={notificationCatalog} />
    </NavigationBar>
  )
}
