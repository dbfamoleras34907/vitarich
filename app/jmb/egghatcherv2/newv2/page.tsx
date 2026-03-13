import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import EggHatchform from "./EggHatchform";

export default function Page() {
  return (
    <NavigationBar
      currentLabel="Add Egg Hatchery"
      fatherLabel="Egg Hatchery Process"
      fatherLink="/jmb/egghatcherv2"
    >
      <EggHatchform />
    </NavigationBar>
  );
}
