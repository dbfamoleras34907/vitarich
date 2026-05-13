export const dynamic = 'force-dynamic'


import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import EggStorageViewPage from "./View"
export default function Page() {
  return (
    <div>
      <NavigationBar
        currentLabel=""
      >
        <EggStorageViewPage />
      </NavigationBar>
    </div>
  )
}

