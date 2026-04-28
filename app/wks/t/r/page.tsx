export const dynamic = 'force-dynamic'


import React from 'react'
import ChildFolder from '@/components/ChildFolder'
import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import Breadcrumb from '@/lib/Breadcrumb'
import { Separator } from '@/components/ui/separator'
import ProjectsChart from './ProjectsChart'
import { Card } from '@/components/ui/card'
import Layout from './Layout'

export default function page() {
    return (
        <div>
            <NavigationBar currentLabel='User' fatherLabel='Administrator' fatherLink='' >
                <div className='max-w-7xl mx-auto'>
                    <Layout />
                </div>
            </NavigationBar>

        </div>
    )
}

