import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import Layout from './Layout'

export default function Page() {
  return (
    <NavigationBar currentLabel="Task Workflow Settings" fatherLabel="Workspace" fatherLink="/wks/dashboard">
      <Layout />
    </NavigationBar>
  )
}
