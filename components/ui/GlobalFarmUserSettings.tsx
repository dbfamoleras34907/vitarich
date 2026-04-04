'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { useGlobalContext } from '@/lib/context/GlobalContext'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

type Farm = {
  id: number
  code: string
  name: string
}

/**
 * Reusable function: filter farms allowed for the user
 */
export function getAllowedFarms(
  farmDB: Farm[],
  userFarms: string[]
): Farm[] {
  if (!farmDB.length || !userFarms.length) return []

  return farmDB.filter((farm) =>
    userFarms.includes(farm.code)
  )
}

export default function GlobalFarmUserSettings() {
  const { getValue, setValue } = useGlobalContext()

  const [userFarms, setUserFarms] = useState<string[]>([])
  const [farmDB, setFarmDB] = useState<Farm[]>([])
  const [defaultFarm, setDefaultFarm] = useState<Farm | null>(null)

  /**
   * Load farms from session
   */
  useEffect(() => {
    const session = getValue('UserInfoAuthSession')

    if (session?.length > 0) {
      setUserFarms(session[0].users_farms || [])
    }
  }, [getValue])

  /**
   * Load farm master list
   */
  useEffect(() => {
    const farms = getValue('getFarmDB') || []
    setFarmDB(farms)
  }, [getValue])

  /**
   * Filter allowed farms
   */
  const allowedFarms = useMemo(() => {
    return getAllowedFarms(farmDB, userFarms)
  }, [farmDB, userFarms])

  /**
   * Initialize default farm
   */
  useEffect(() => {
    const session = getValue('UserInfoAuthSession')
    const currentDefaultFarmId = getValue('DefaultFarmId')
    console.log({ currentDefaultFarmId ,session} ,session[0]?.default_farm)
    if (!session?.length) return

    const sessionDefaultFarmId = session[0]?.default_farm

    if (!currentDefaultFarmId && sessionDefaultFarmId) {
      setValue('DefaultFarmId', sessionDefaultFarmId)

      const farm = farmDB.find(
        (f) => f.id === sessionDefaultFarmId
      )

      if (farm) setDefaultFarm(farm)
    }

    if (currentDefaultFarmId) {
      const farm = farmDB.find(
        (f) => f.id === currentDefaultFarmId
      )

      if (farm) setDefaultFarm(farm)
    }
  }, [farmDB, getValue, setValue])

  /**
   * Handle farm selection
   */
  const handleSelectFarm = (farm: Farm) => {
    setValue('DefaultFarmId', farm.id)
    setDefaultFarm(farm)
  }

  return (
    <div className="rounded-xl border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Farm Code</TableHead>
            <TableHead>Farm Name</TableHead>
            <TableHead className="text-right">
              Default
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {allowedFarms.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-center text-muted-foreground"
              >
                No farms available
              </TableCell>
            </TableRow>
          )}

          {allowedFarms.map((farm) => {
            const isSelected =
              defaultFarm?.id === farm.id

            return (
              <TableRow
                key={farm.id}
                onClick={() =>
                  handleSelectFarm(farm)
                }
                className={`
                  cursor-pointer transition
                  hover:bg-accent
                  ${isSelected ? 'bg-accent' : ''}
                `}
              >
                <TableCell className="font-medium">
                  {farm.code}
                </TableCell>

                <TableCell>
                  {farm.name}
                </TableCell>

                <TableCell className="text-right">
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary inline" />
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}