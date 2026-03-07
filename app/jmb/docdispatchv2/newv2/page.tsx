import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import DocdispatchForm from "./DocdispatchForm"
 
export default function Page() {
  return (
    <NavigationBar
      currentLabel="Doc Dispatch"
    >
      <DocdispatchForm />
    </NavigationBar>
  )
}
