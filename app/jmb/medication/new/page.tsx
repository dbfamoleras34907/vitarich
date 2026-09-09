export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import MedicationForm from "./MedicationForm";

export default function Page() {
  return (
    <NavigationBar
      currentLabel="Add Medication"
      fatherLink="/jmb/medication"
      fatherLabel="Medication"
    >
      <MedicationForm />
    </NavigationBar>
  );
}
