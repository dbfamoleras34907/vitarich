export const dynamic = "force-dynamic";
import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import BoilerForm from "./BoilerForm";

export default function page() {
  return (
    <div>
      <NavigationBar currentLabel="">
        <BoilerForm />
      </NavigationBar>
    </div>
  );
}
