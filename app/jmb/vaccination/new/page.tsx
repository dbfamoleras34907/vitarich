export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import VaccinationForm from "./VaccinationForm";

export default function Page() {
  return (
    <NavigationBar currentLabel="Add Vaccination" fatherLink="/jmb/vaccination" fatherLabel="Vaccination">
      <VaccinationForm />
    </NavigationBar>
  );
}
