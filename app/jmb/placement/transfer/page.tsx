export const dynamic = "force-dynamic";

import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import TransferForm from "./TransferForm";

export default function Page() {
  return (
    <NavigationBar currentLabel="Transfer History" fatherLink="/jmb/placement" fatherLabel="Placement">
      <TransferForm />
    </NavigationBar>
  );
}
