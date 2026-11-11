import NavigationBar from '@/components/ui/sidebar/NavigationBar'

import GeneralSettingsLayout from './Layout'

export default function Page() {
  return (
    <NavigationBar currentLabel="General Settings" fatherLabel="Broiler">
      <GeneralSettingsLayout />
    </NavigationBar>
  )
}
