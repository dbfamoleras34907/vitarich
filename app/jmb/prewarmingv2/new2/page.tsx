export const dynamic = 'force-dynamic'


 import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import Prewarmingform from "./Prewarmingform"

export default function Page() {
  return (
    <NavigationBar 
    currentLabel="Egg Pre-Warming" 
    fatherLink="/a_dean/hatchery" 
    fatherLabel="Hatchery">
      <Prewarmingform />
    </NavigationBar>
  )
}


