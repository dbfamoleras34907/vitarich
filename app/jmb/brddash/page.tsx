export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import BreederDashboard from "./BreederDashboard";

export default function Page() {
  return (
    <NavigationBar currentLabel="Breeder Dashboard">
      <BreederDashboard />
    </NavigationBar>
  );
}
