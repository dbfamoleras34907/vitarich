// app/a_baja/eggtransfer/new/page.tsx

import NavigationBar from "@/components/ui/sidebar/NavigationBar" 
import EggTransferForms from "./EggTransferForms"

export default function Page() {
  return (
    <NavigationBar 
            currentLabel="New Egg Transfer" 
            fatherLink="/a_baja/eggtransfer" 
            fatherLabel="Egg Transfer">
      <EggTransferForms/>
    </NavigationBar>
  )
}
