export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import MultipleBreederDispatchForm from "./MultipleBreederDispatchForm";

export default function Page() {
  return (
    <NavigationBar
      currentLabel="Breeder Multiple Dispatch"
      fatherLink="/jmb/breederdispatch"
      fatherLabel="Breeder Dispatch"
    >
      <MultipleBreederDispatchForm />
    </NavigationBar>
  );
}
