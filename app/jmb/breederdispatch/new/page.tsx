export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import BreederDispatchForm from "./BreederDispatchForm";

export default function Page() {
  return (
    <NavigationBar
      currentLabel="New Dispatch"
      fatherLink="/jmb/breederdispatch"
      fatherLabel="Breeder Dispatch"
    >
      <BreederDispatchForm />
    </NavigationBar>
  );
}
