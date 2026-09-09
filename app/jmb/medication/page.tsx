export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import MedicationTable from "./madication-table";

export default function Page() {
  return (
    <NavigationBar currentLabel="Medication">
      <MedicationTable />
    </NavigationBar>
  );
}
