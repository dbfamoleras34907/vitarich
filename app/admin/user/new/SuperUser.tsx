'use client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User } from '@supabase/supabase-js'
import React, { useEffect, useState } from 'react'
import { getProfileByAuthId } from '../api'
import { UserRow } from '@/lib/types'
import { db } from '@/lib/Supabase/supabaseClient'
import { BracketCheckbox } from '@/components/BracketCheckbox '

export default function SuperUser() {
    const [loggedInUser, setLoggedInUser] = useState<User | null>(null)
    const [usersInfo, setusersInfo] = useState<UserRow | null>(null)
    const [sampleChecked, setSampleChecked] = useState(false)


    const getUserInfoFromDatabase = async (authId: string) => {
        const existingProfile = await getProfileByAuthId(authId)
        setusersInfo(existingProfile)
    }


    const handleCheckboxChange = (isChecked: boolean) => {
        // const isChecked = e.target.checked
        setusersInfo(prev => prev ? { ...prev, issuper: isChecked ? "1" : "0" } : null)
    }

    useEffect(() => {
        if (loggedInUser?.id) {
            getUserInfoFromDatabase(loggedInUser.id)
        }
    }, [loggedInUser])

    useEffect(() => {
        const getSessionUser = async () => {
            const { data: { session } } = await db.auth.getSession()
            setLoggedInUser(session?.user ?? null)
        }
        getSessionUser()
    }, [])


    return (
        <div className='mx-4 flex w-fit items-center'>
            {/* <Input
                type='checkbox'
                id='issuper'
                disabled
                checked={usersInfo?.issuper === "1"}
                onChange={handleCheckboxChange}
                name='issuper'
            /> */}
            <BracketCheckbox checked={usersInfo?.issuper === "1"} onChange={handleCheckboxChange} />

            {/* <BracketCheckbox checked={sampleChecked} onChange={() => setSampleChecked(prev => !prev)
            } /> */}

            <label htmlFor='issuper' className='whitespace-nowrap mx-2'>Super User</label>
        </div>
    )
}