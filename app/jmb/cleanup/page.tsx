export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import CleanupTable from "./cleanup-table";

export default function Page() {
  return (
    <NavigationBar currentLabel="Breeder Terminal Culling">
      <CleanupTable />
    </NavigationBar>
  );
}
