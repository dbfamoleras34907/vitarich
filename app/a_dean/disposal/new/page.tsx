export const dynamic = 'force-dynamic'
import React from 'react'
import NavigationBar from '@/components/ui/sidebar/NavigationBar';
import Layout from './Layout';
import Breadcrumb from '@/lib/Breadcrumb';


export default function page() {

    return (
        <div>
            <NavigationBar currentLabel="">
                <div className='mx-4'>
                
                    <Layout />
                </div>
            </NavigationBar>
        </div>
    )
}


