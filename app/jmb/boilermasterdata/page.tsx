import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import BoilerTable from "./boiler-table";

export default function Page() {
  return (
    <NavigationBar
      currentLabel="Boiler Masterdata"
      fatherLink="./"
      fatherLabel="Boiler List"
    >
      <BoilerTable />
    </NavigationBar>
  );
}
