export const dynamic = 'force-dynamic'

import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import Layout from './Layout'

export default function Page() {
  return (
    <NavigationBar currentLabel="Feed Farm Transfer" fatherLabel="Broiler">
      <Layout />
    </NavigationBar>
  )
}
