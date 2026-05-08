export const dynamic = 'force-dynamic'


import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import React from 'react' 
import Layout from './Layout'

export default function page() {
    return (
        <div>
            <NavigationBar currentLabel='User' fatherLabel='Administrator' fatherLink='./' >
               <div className='max-w-6xl mx-auto'>
                 <Layout />
               </div>
            </NavigationBar>
        </div>
    )
} 

