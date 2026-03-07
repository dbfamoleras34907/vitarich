
import ChickgradingTable from "./Chickgrading-table"
import NavigationBar from "@/components/ui/sidebar/NavigationBar"

export default function Page() {
  return (
    <NavigationBar 
        currentLabel="Chick Grading" 
        fatherLink="./" 
        fatherLabel="Hatchery"
    >

      <ChickgradingTable />
    </NavigationBar>
  )
}
