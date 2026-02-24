export const dynamic = 'force-dynamic'


import React from 'react'
import NavigationBar from '@/components/ui/sidebar/NavigationBar';
import ProjectTicketsPage from './Layout';
 

export default function page() {

    return (
        <div>
            <NavigationBar currentLabel="">
                <ProjectTicketsPage />
            </NavigationBar>
        </div>
    )
}


