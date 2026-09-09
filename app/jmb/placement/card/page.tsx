import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import CardForm from "./CardForm";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <NavigationBar
      currentLabel="Breeder Pen Card"
      fatherLink="/jmb/placement"
      fatherLabel="Breeder Placement"
    >
      <CardForm />
    </NavigationBar>
  );
}
