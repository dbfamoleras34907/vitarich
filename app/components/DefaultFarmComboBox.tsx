'use client'
import React, { useEffect, useState } from 'react'
import { getUserFarms } from '../admin/user/new/api'
import SearchableCombobox from '@/components/SearchableCombobox'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { AuthUser } from '../admin/user/new/Layout'

type Params = {
    label: string
    setValue: (value: any) => void
    value: any
}

export default function DefaultFarmComboBox({
    label,
    setValue,
    value,
}: Params) {

    const { getValue } = useGlobalContext()

    const [farmList, setFarmList] = useState<any[]>([])
    const [authSelected, setAuthSelected] = useState<AuthUser | null>(null)

    useEffect(() => {
        const selectedUser = getValue('UserInfoAuthSession')
        if (selectedUser) {
            setAuthSelected(selectedUser[0])
        }
    }, [getValue])


    useEffect(() => {
        if (!authSelected?.id) return
        const init = async () => {
            const farms = await getUserFarms(Number(authSelected.id))
            setFarmList(farms || [])
        }
        init()

    }, [authSelected])


    /**
     * Set default combobox value
     * Priority:
     * 1. DefaultFarmId
     * 2. selectedUser.id (fallback)
     */
    useEffect(() => {
        if (value) return
        if (!farmList.length) return

        const defaultFarmId = getValue('DefaultFarmId')
        const selectedUser = getValue('selectedUser')

        if (defaultFarmId) {
            setValue(defaultFarmId)
            return
        }

        if (selectedUser?.id) {
            setValue(selectedUser.id)
        }

    }, [farmList, value, getValue, setValue])


    return (
        <>
            <SearchableCombobox
                required
                label={label}
                showCode
                items={farmList}
                value={value ?? ''}
                onValueChange={setValue}
                className="w-full"
            />
        </>
    )
}