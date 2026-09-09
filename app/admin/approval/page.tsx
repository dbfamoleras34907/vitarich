export const dynamic = 'force-dynamic'


import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import React from 'react' 
import Layout from './Layout'

export default function page() {
    return (
        <div>
            <NavigationBar currentLabel='Approval' fatherLabel='Settings' fatherLink='/admin' >
                <Layout />
            </NavigationBar>
        </div>
    )
} 

