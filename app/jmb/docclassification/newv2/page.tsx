import Chickgradingform from "./Chickgradingform"
import NavigationBar from "@/components/ui/sidebar/NavigationBar"

export default function Page() {
  return (
    <NavigationBar
      currentLabel="Chick Grading"
      fatherLink="/a_dean/hatchery"
      fatherLabel="Hatchery">
      <Chickgradingform />
    </NavigationBar>
  )
}
