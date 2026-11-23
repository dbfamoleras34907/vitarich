import NavigationBar from "@/components/ui/sidebar/NavigationBar"

import SystemSettingsLayout from "./Layout"

export default function Page() {
  return (
    <NavigationBar currentLabel="" fatherLabel="">
      <SystemSettingsLayout />
    </NavigationBar>
  )
}
