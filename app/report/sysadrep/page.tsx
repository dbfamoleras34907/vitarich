export const dynamic = 'force-dynamic'


import React from 'react'
import NavigationBar from '@/components/ui/sidebar/NavigationBar';
import Layout from './Layout';

export default function page() {

    return (
        <div>
            <NavigationBar currentLabel="">
                <Layout />
            </NavigationBar>
        </div>
    )
}


