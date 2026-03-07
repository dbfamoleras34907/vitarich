export const dynamic = 'force-dynamic'


 

import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import Eggstorageform from "./Eggstorageform"

export default function Page() {
  return (
    <NavigationBar
      currentLabel="Egg Storage - New"
      fatherLink="/a_baja/eggstorage"
      fatherLabel="Egg Storage"
    >
      <Eggstorageform />
    </NavigationBar>
  )
}

