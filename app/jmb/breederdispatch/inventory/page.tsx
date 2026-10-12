import NavigationBar from "@/components/ui/sidebar/NavigationBar";
import InventoryView from "./InventoryView";

export default function Page() {
  return <NavigationBar currentLabel="Breeder Dispatch"><InventoryView /></NavigationBar>;
}
