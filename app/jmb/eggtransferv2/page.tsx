import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import EggTransferTable from "./eggtrasfer-table";
export default function Page() {
  return (
    <NavigationBar
      currentLabel="Egg Transfer"
      fatherLink="/jmb"
      fatherLabel="Hatchery"
    >
      <EggTransferTable />
    </NavigationBar>
  );
}
