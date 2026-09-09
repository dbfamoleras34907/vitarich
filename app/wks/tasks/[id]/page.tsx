import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import Layout from './Layout'
export default function page() {
    return (
        <div>
            <NavigationBar currentLabel='Task Details' fatherLabel='Tasks' fatherLink='/wks/tasks' >
                <div className='max-w-7xl mx-auto'>
                    <Layout />
                </div>
            </NavigationBar>
        </div>
    )
}

