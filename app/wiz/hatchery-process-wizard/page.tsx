export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import HatcheryProcessWizard from "./HatcheryProcessWizard";

export default function Page() {
  return (
    <NavigationBar
      currentLabel="Hatchery Process Wizard"
      fatherLink="/a_dean/hatchery"
      fatherLabel="Hatchery"
    >
      <HatcheryProcessWizard />
    </NavigationBar>
  );
}
