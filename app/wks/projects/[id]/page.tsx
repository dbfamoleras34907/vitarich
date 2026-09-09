import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import Layout from './Layout'
export default function page() {
    return (
        <div>
            <NavigationBar currentLabel='Project Details' fatherLabel='Projects' fatherLink='/wks/projects' >
                <div className='max-w-7xl mx-auto px-4 '>
                    <Layout />
                </div>
            </NavigationBar>
        </div>
    )
}

