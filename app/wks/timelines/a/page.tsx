import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import Layout from './Layout'
export default function page() {
    return (
        <div>
            <NavigationBar currentLabel='Timesheet Report' fatherLabel='Timesheets' fatherLink='/wks/timelines' >
                <div className='max-w-7xl mx-auto'>
                    <Layout />
                </div>
            </NavigationBar>
        </div>
    )
}

