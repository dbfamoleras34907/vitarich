export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import EggLayingForm from "./EggLayingForm";

export default function Page() {
  return (
    <NavigationBar
      currentLabel="New Egg Laying"
      fatherLink="/jmb/egglaying"
      fatherLabel="Egg Laying"
    >
      <EggLayingForm />
    </NavigationBar>
  );
}
