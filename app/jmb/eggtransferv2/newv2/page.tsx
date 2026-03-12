import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import EggTransferForms from "./EggTransferForms";

export default function Page() {
  return (
    <NavigationBar
      currentLabel="New Egg Transfer"
      fatherLink="/jmb/eggtransfer"
      fatherLabel="Egg Transfer"
    >
      <EggTransferForms />
    </NavigationBar>
  );
}
