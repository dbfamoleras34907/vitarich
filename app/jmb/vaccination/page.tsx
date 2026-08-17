export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import VaccinationTable from "./vaccination-table";

export default function Page() {
  return <NavigationBar currentLabel="Vaccination"><VaccinationTable /></NavigationBar>;
}
