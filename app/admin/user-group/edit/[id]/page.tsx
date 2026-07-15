export const dynamic = 'force-dynamic'

import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import Layout from './Layout'

export default function Page() {
  return (
    <NavigationBar currentLabel="Edit User Group" fatherLabel="User Group" fatherLink="/admin/user-group">
      <Layout />
    </NavigationBar>
  )
}
