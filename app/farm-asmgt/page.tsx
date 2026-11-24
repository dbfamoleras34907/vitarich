export const dynamic = 'force-dynamic'

import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import FarmAssignmentLayout from './Layout'

export default function Page() {
  return (
    <NavigationBar currentLabel="Farm Assignment" fatherLabel="Settings" fatherLink="/admin">
      <FarmAssignmentLayout />
    </NavigationBar>
  )
}
