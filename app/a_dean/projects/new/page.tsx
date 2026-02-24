export const dynamic = 'force-dynamic'


import React from 'react'
import NavigationBar from '@/components/ui/sidebar/NavigationBar';
import ProjectsPage from './ProjectsPage';
 

export default function page() {

    return (
        <div>
            <NavigationBar currentLabel="">
                <ProjectsPage />
            </NavigationBar>
        </div>
    )
}


