import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import NotificationInbox from "./NotificationInbox"

export default function Page() {
  return <NavigationBar currentLabel="Notifications"><NotificationInbox /></NavigationBar>
}
