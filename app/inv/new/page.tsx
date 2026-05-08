export const dynamic = 'force-dynamic'


import NavigationBar from '@/components/ui/sidebar/NavigationBar';
import Layout from './Layout';

export default function page() {

    return (
        <div>
            <NavigationBar currentLabel="" fatherLabel=''>
                <Layout />
            </NavigationBar>
        </div>
    )
}


