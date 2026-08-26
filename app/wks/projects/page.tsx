import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import Layout from './Layout'
export default function page() {
    return (
        <div>
            <NavigationBar currentLabel='Projects' fatherLabel='Workspace' fatherLink='/wks/dashboard' >
                <div className='max-w-7xl mx-auto'>
                    <Layout />
                </div>
            </NavigationBar>
        </div>
    )
}

