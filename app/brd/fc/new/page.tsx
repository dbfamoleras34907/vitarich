export const dynamic = 'force-dynamic'


import NavigationBar from '@/components/ui/sidebar/NavigationBar';
import Layout from './Layout';

export default function page() {
    const devMode = process.env.DEVMODE?.trim().toLowerCase() === 'true'

    return (
        <div>
            <NavigationBar currentLabel="" fatherLabel=''>
                <Layout devMode={devMode} />
            </NavigationBar>
        </div>
    )
}


