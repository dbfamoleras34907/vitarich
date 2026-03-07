export const dynamic = 'force-dynamic'


import NavigationBar from "@/components/ui/sidebar/NavigationBar" 
import EggsetterForm from "./Eggsetterform" 

export default function Page() {
  return (
    <div>
      <NavigationBar
        currentLabel="New Egg Setting"
        fatherLink="/a_baja/eggsetter"
        fatherLabel="Egg Setter"
      >
        <EggsetterForm />
      </NavigationBar>
    </div>
  )
}

