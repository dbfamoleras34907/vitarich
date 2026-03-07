export const dynamic = 'force-dynamic'


import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import EggTable from "./egg-table"
export default function Page() {
  return (
    <div>
      <NavigationBar
       currentLabel=""
      >
        <EggTable />
      </NavigationBar>
    </div>
  )
}


