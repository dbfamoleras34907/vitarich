export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import MortalityReport from "./MortalityReport";

export default function Page() {
  return (
    <NavigationBar currentLabel="">
      <MortalityReport />
    </NavigationBar>
  );
}
