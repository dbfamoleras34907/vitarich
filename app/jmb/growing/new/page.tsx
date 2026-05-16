import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import GrowingForm from "./GrowingForm";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <NavigationBar
      currentLabel="New Growing"
      fatherLink="/jmb/growing"
      fatherLabel="Growing"
    >
      <GrowingForm />
    </NavigationBar>
  );
}
