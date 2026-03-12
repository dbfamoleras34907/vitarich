'use client'
import { checkUserActive } from '@/lib/CheckUserIfActive';
import { getAuthId } from '@/lib/getAuthId';
import React, { useLayoutEffect } from 'react'

export default function page() {

    const check = async () => {
        const authId = await getAuthId();

        await checkUserActive(authId || "");
    }
    useLayoutEffect(() => {
        check()
    }, [])
    return (
        <div> </div>
    )
}
