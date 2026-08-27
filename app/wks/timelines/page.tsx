import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import TimesheetReport from './a/Layout'
export default function page() {
    return (
        <div>
            <NavigationBar currentLabel='Timesheets' fatherLabel='Workspace' fatherLink='/wks/dashboard' >
                <div className='max-w-7xl mx-auto'>
                    <TimesheetReport />
                </div>
            </NavigationBar>
        </div>
    )
}

