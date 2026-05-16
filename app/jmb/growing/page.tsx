export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import GrowingTable from "./growing-table";

export default function Page() {
  return (
    <NavigationBar currentLabel="">
      <GrowingTable />
    </NavigationBar>
  );
}
