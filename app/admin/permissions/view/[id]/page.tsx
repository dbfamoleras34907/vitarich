import NavigationBar from '@/components/ui/sidebar/NavigationBar'
import React from 'react'
import Layout from './Layout'

export default function page() {
    return (
        <div>

            <NavigationBar currentLabel="Permission Template">
                <Layout   />
            </NavigationBar>
        </div>
    )
}
