export const dynamic = 'force-dynamic'

import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import Layout from '../new/Layout'

export default function Page() {
  return (
    <NavigationBar currentLabel="" fatherLabel="">
      <Layout mode="post" />
    </NavigationBar>
  )
}
