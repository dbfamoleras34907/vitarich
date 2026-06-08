import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import GradingForm from "./GradingForm";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <NavigationBar
      currentLabel="New Grading"
      fatherLink="/jmb/growing"
      fatherLabel="Population Record"
    >
      <GradingForm />
    </NavigationBar>
  );
}
