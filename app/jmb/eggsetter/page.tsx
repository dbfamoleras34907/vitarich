export const dynamic = 'force-dynamic'


import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import EggsetterTable from "./eggsetter-table"

export default function Page() {
  return (
    <NavigationBar 
      currentLabel="" 
      >
        <EggsetterTable />
    </NavigationBar>
  )
}


