'use client'
import { useEffect, useState } from 'react'
import { getUserFarms } from '../admin/user/new/api'
import SearchableCombobox, { type ComboboxItemType } from '@/components/SearchableCombobox'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { AuthUser } from '../admin/user/new/Layout'

type Params = {
    label?: string | null
    setValue: (value: string | number) => void
    value?: string | number | null
    autoDefault?: boolean
}

export default function DefaultFarmComboBox({
    label = "",
    setValue,
    value,
    autoDefault = true,
}: Params) {
    // commit to build
    const { getValue } = useGlobalContext()
    const selectedUser = getValue('UserInfoAuthSession')?.[0] as AuthUser | undefined

    const [farmList, setFarmList] = useState<ComboboxItemType[]>([])

    useEffect(() => {
        if (!selectedUser?.id) return
        const init = async () => {
            const farms = await getUserFarms(Number(selectedUser.id))
            setFarmList(Array.isArray(farms) ? farms as ComboboxItemType[] : [])
        }
        init()

    }, [selectedUser?.id])


    /**
     * Set default combobox value
     * Priority:
     * 1. DefaultFarmId
     * 2. selectedUser.id (fallback)
     */
    useEffect(() => {
        if (!autoDefault) return
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

    }, [autoDefault, farmList, value, getValue, setValue])


    return (
        <>
            <SearchableCombobox
                required
                label={label ? label : ""}
                showCode
                items={farmList}
                value={value ?? ''}
                onValueChange={setValue}
                className="w-full"
            />
        </>
    )
}
