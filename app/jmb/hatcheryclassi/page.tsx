export const dynamic = 'force-dynamic'


import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import HatchTable from "./hatch-table"

export default function Page() {
  return (
    <div>
      <NavigationBar
        currentLabel="Hatchery Classification"
        fatherLink="/a_dean/hatchery"
        fatherLabel="Hatchery"
      >
        <HatchTable />
      </NavigationBar>
    </div>
  )
}


