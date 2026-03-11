

import React from 'react'
import NavigationBar from '@/components/ui/sidebar/NavigationBar';
import Layout from './Layout';

export default async function page() {
    return (
        <div>
            <NavigationBar currentLabel="Hatchery - Receiving" fatherLabel=''>
                <Layout />
            </NavigationBar>
        </div>
    )
}


