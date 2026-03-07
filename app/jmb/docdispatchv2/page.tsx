 

import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import DocdispatchTable from "./docdispatch-table"

export default function Page() {
  return (
    <NavigationBar
        currentLabel="Doc Dispatch" 
        fatherLink="./" 
        fatherLabel="Hatchery"
    >
      <DocdispatchTable />
    </NavigationBar>
  )
}

