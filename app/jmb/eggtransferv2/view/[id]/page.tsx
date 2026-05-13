import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import Layout from "./Layout";
export default function Page() {
  return (
    <NavigationBar
      currentLabel="Egg Transfer"
      fatherLink="/jmb"
      fatherLabel="Hatchery"
    >
      <Layout />
    </NavigationBar>
  );
}
