'use client'
import { useCallback, useEffect, useState } from 'react'
import { getUserFarms } from '../admin/user/new/api'
import SearchableCombobox, { type ComboboxItemType } from '@/components/SearchableCombobox'
import { useGlobalContext } from '@/lib/context/GlobalContext'

type FarmOption = ComboboxItemType & {
    id?: number | string
    farm_id?: number | string
    farm_code?: string
    farm_name?: string
}

type Params = {
    label?: string | null
    setValue: (value: string | number) => void
    value?: string | number | null
    autoDefault?: boolean
    valueKey?: 'id' | 'code'
}

export default function DefaultFarmComboBox({
    label = "",
    setValue,
    value,
    autoDefault = true,
    valueKey = 'code',
}: Params) {
    // commit to build
    const { getValue } = useGlobalContext()
    const selectedUser = getValue('UserInfoAuthSession')?.[0] as { id?: string | number } | undefined

    const [farmList, setFarmList] = useState<FarmOption[]>([])

    const getFarmId = useCallback((farm?: FarmOption) => farm?.id ?? farm?.farm_id, [])

    const normalizeFarm = useCallback((farm: FarmOption, masterList: FarmOption[] = []): FarmOption | null => {
        const code = farm.code ?? farm.farm_code ?? ''
        const masterFarm = masterList.find((item) => item.code === code)
        const id = getFarmId(farm) ?? getFarmId(masterFarm)

        if (!code) return null

        return {
            ...farm,
            id,
            code,
            name: farm.name ?? farm.farm_name ?? masterFarm?.name ?? code,
        }
    }, [getFarmId])

    useEffect(() => {
        if (!selectedUser?.id) return
        const init = async () => {
            const session = getValue('UserInfoAuthSession')
            const userFarmCodes = session?.[0]?.users_farms || []
            const farmDB = (getValue('getFarmDB') || []) as FarmOption[]
            const allowedFarms = farmDB
                .filter((farm) => userFarmCodes.includes(farm.code))
                .map((farm) => normalizeFarm(farm, farmDB))
                .filter((farm): farm is FarmOption => Boolean(farm))

            if (allowedFarms.length) {
                setFarmList(allowedFarms)
                return
            }

            const farms = await getUserFarms(Number(selectedUser.id))
            const normalizedFarms = Array.isArray(farms)
                ? (farms as FarmOption[])
                    .map((farm) => normalizeFarm(farm, farmDB))
                    .filter((farm): farm is FarmOption => Boolean(farm))
                : []

            setFarmList(normalizedFarms)
        }
        init()

    }, [getValue, normalizeFarm, selectedUser?.id])

    const selectedFarm = farmList.find((farm) =>
        valueKey === 'id'
            ? String(getFarmId(farm)) === String(value)
            : farm.code === String(value ?? '')
    )

    const comboboxValue = valueKey === 'id'
        ? selectedFarm?.code ?? ''
        : value == null ? '' : String(value)

    const getReturnValue = (farmCode: string) => {
        if (valueKey === 'code') return farmCode

        const farm = farmList.find((item) => item.code === farmCode)
        return getFarmId(farm) ?? ''
    }

    const emitValue = useCallback((nextValue: string | number) => {
        if (nextValue === '') return
        if (String(nextValue) === String(value ?? '')) return

        setValue(nextValue)
    }, [setValue, value])

    /**
     * Set default combobox value
     * Priority:
     * 1. DefaultFarmId
     * 2. First available user farm
     */
    useEffect(() => {
        if (!autoDefault) return
        if (value) return
        if (!farmList.length) return

        const defaultFarmId = getValue('DefaultFarmId')

        let nextValue: string | number | undefined

        if (defaultFarmId) {
            const defaultFarm = farmList.find((farm) => String(getFarmId(farm)) === String(defaultFarmId))
            if (defaultFarm) {
                nextValue = valueKey === 'id' ? getFarmId(defaultFarm) : defaultFarm.code
            }
        }

        if (nextValue === undefined) {
            const firstFarm = farmList[0]
            nextValue = valueKey === 'id' ? getFarmId(firstFarm) : firstFarm?.code
        }

        if (nextValue !== undefined) {
            emitValue(nextValue)
        }

    }, [autoDefault, farmList, value, getValue, valueKey, emitValue, getFarmId])


    return (
        <>
            <SearchableCombobox
                required
                label={label ? label : ""}
                showCode
                items={farmList}
                value={comboboxValue}
                onValueChange={(farmCode) => emitValue(getReturnValue(farmCode))}
                className="w-full"
            />
        </>
    )
}
