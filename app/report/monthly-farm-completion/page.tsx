import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import MonthlyFarmCompletionReport from './MonthlyFarmCompletionReport'

export const dynamic = 'force-dynamic'

export default function Page() {
  return <NavigationBar currentLabel=""><MonthlyFarmCompletionReport /></NavigationBar>
}
