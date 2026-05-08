'use client'

import { useMemo } from 'react'
import { useGlobalContext } from '@/lib/context/GlobalContext'

interface Permission {
    ilink: string
    is_visible: boolean
}

export const usePermission = (
    link: string
): boolean => {
    const { getValue } = useGlobalContext()

    const hasPermission = useMemo(() => {
        try {
            const rawPermissions = getValue('UserPermission')

            console.log({ rawPermissions })

            const permissions: Permission[] =
                typeof rawPermissions === 'string'
                    ? JSON.parse(rawPermissions)
                    : rawPermissions || []

            const permission = permissions.find(
                (p) => p.ilink === link
            )

            if (!permission) {
                return false
            }

            return Boolean(permission.is_visible)

        } catch {
            return false
        }
    }, [getValue, link])

    return !hasPermission
}