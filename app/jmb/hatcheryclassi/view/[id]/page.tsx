export const dynamic = 'force-dynamic'


import NavigationBar from "@/components/ui/sidebar/NavigationBar"
import Layout from "./Layout"

export default function Page() {
  return (
    <div>
      <NavigationBar
        currentLabel="Hatchery Classification"
        fatherLink="/a_dean/hatchery"
        fatherLabel="Hatchery"
      >
        <div>
          <Layout />
        </div>
      </NavigationBar>
    </div>
  )
}


