
'use client'
import Image from 'next/image';
import { useRouter } from 'next/navigation'
import React, { useLayoutEffect } from 'react'
import { sleep } from '@/lib/utils';
import { logout } from '@/lib/Supabase/supabaseClient';
import { useGlobalContext } from '@/lib/context/GlobalContext';
export default function Layout() {
    const router = useRouter();
    const { clearStore } = useGlobalContext();
    useLayoutEffect(() => {
        const x = async () => {
            sleep(500)
            await logout();
            clearStore();
            router.push("/");
        };
        x();
    }, [router])
    return (
        <div className='mx-auto w-fit mt-25 grid gap-2'>
            <a href="#" className="flex items-center gap-2 font-medium">
                <div className="  text-primary-foreground flex size-6 items-center justify-center rounded-md">
                    {/* <Image src={} alt="" className="rounded-full invert" /> */}
                </div>Vita Rich
            </a>
            <div className='text-2xl'>You signed out of your account</div>
            <span className='text-muted-foreground'> {"It's"} Good Idea to Close all browser windows.</span>
        </div>
    )
}
