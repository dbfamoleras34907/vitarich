'use client'
import { checkUserActive } from '@/lib/CheckUserIfActive';
import { getAuthId } from '@/lib/getAuthId';
import React, { useLayoutEffect } from 'react'

export default function page() {

    const check = async () => {
        const authId = await getAuthId();
        console.log("Auth ID:", authId);
        await checkUserActive(authId || "");
    }
    useLayoutEffect(() => {
        check()
    }, [])
    return (
        <div> </div>
    )
}
