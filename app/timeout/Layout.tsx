
'use client'
import { useRouter } from 'next/navigation'
import React, { useEffect } from 'react'
import { logout } from '@/lib/Supabase/supabaseClient';
import { useGlobalContext } from '@/lib/context/GlobalContext';
import VitaLogo from '../Imgs/svgs';
export default function Layout() {
    const router = useRouter();
    const { clearStore } = useGlobalContext();
    useEffect(() => {
        const x = async () => {
            await logout();
            clearStore();
            router.replace("/");
        };
        void x();
    }, [clearStore, router])
    return (
        <div className='mx-auto w-fit mt-25 grid gap-2'>
            <a href="#" className="flex items-center gap-2 font-medium">
                <div className="  text-primary-foreground flex   items-center justify-center rounded-md">
                    <VitaLogo height={40} width={40} />
                    {/* <Image src={} alt="" className="rounded-full invert" /> */}
                </div>Vita Rich
            </a>
            <div className='text-2xl'>Session timed out</div>
            <span className='text-muted-foreground'>You were signed out because no activity was detected.</span>
        </div>
    )
}
