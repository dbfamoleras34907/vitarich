export const dynamic = 'force-dynamic'


import NavigationBar from '@/components/ui/sidebar/NavigationBar';
import HomeDashboard from './HomeDashboard';

export default function page() {

    return (
        <div>
            <NavigationBar currentLabel="" fatherLabel=''>
                <HomeDashboard/>
            </NavigationBar>
        </div>
    )
}


