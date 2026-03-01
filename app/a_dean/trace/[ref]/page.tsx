export const dynamic = 'force-dynamic'


import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import TracePage from './TracePage'
export default function page() {
    return (
        <div>
            <NavigationBar currentLabel='' fatherLink='./' fatherLabel='Warehouse Master'>
                <TracePage />
            </NavigationBar>

        </div>
    )
}

