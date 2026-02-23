// export const dynamic = 'force-dynamic'
import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import PrewarmTable from "./prewarm-table"

export default function Page() {
  return (
    <NavigationBar
        currentLabel="Pre-Warming"
        fatherLink="/a_dean/hatchery"
        fatherLabel="Hatchery"
    >
      <PrewarmTable />
    </NavigationBar>
  )
}


