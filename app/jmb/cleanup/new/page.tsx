export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import CleanupForm from "./CleanupForm";

export default function Page() {
  return (
    <NavigationBar
      currentLabel="New Terminal Culling"
      fatherLink="/jmb/cleanup"
      fatherLabel="Breeder Terminal Culling"
    >
      <CleanupForm />
    </NavigationBar>
  );
}
