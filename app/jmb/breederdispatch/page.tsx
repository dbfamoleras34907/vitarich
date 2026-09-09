export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import BreederDispatchTable from "./breeder-table";

export default function Page() {
  return (
    <NavigationBar currentLabel="Breeder Dispatch">
      <BreederDispatchTable />
    </NavigationBar>
  );
}
