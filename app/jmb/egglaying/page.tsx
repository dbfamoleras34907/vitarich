export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import EggLayingTable from "./egglaying-table";

export default function Page() {
  return (
    <NavigationBar currentLabel="">
      <EggLayingTable />
    </NavigationBar>
  );
}
