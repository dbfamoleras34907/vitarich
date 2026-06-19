export const dynamic = 'force-dynamic'


import React from 'react'
import Layout from './Layout';
import NavigationBar from '@/components/ui/sidebar/NavigationBar';

export default function page() {
   
    return (
        <div>
            <NavigationBar currentLabel="" fatherLabel=''>
                <Layout />
            </NavigationBar>
        </div>
    )
}


// 