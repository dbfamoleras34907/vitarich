import React from 'react'
import Layout from './Layout'
import NavigationBar from '@/components/ui/sidebar/NavigationBar'

export default function page() {
    return (
        <NavigationBar currentLabel="Hatchery - Receiving" fatherLabel=''>
            <Layout />
        </NavigationBar>
    )
}
