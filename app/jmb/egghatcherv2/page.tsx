import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import EggHatchTable from "./egghatch-table"

export default function Page() {
  return (
    <NavigationBar
      currentLabel=""
    >
      <EggHatchTable />
    </NavigationBar>
  )
}
