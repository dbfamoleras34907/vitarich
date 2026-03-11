export const dynamic = 'force-dynamic'


import NavigationBar from '@/components/ui/sidebar/NavigationBar'    
import Hatchfromx from './Hatchform'

export default function page() {
    return (
        <div>
            <NavigationBar currentLabel='Hatch Classification Information' fatherLink='./' fatherLabel='Hatchery'>
                <Hatchfromx />
            </NavigationBar> 
        </div>
    )
}

