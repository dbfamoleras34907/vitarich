import NavigationBar from "@/components/ui/sidebar/NavigationBar"  
import EggHatchform from "./EggHatchform"

export default function Page() {
  return (
    <NavigationBar
      currentLabel="Add Egg Hatchery"
      fatherLabel="Egg Hatchery Process"
      fatherLink="/a_baja/egghatcheryprocessform"
    >
      <EggHatchform />
    </NavigationBar>
  )
}
