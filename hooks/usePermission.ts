'use client'

import { useMemo } from 'react'
import { useGlobalContext } from '@/lib/context/GlobalContext'
import { NavFolders } from '@/lib/Defaults/DefaultValues'

interface Permission {
    ilink: string
    is_visible: boolean
}

export const usePermission = (link: string): boolean => {
    const { getValue } = useGlobalContext()

    const hasPermission = useMemo(() => {
        try {
            const session = getValue('UserInfoAuthSession')
            const profile = Array.isArray(session) ? session[0] : null
            const userType = Number(profile?.user_type ?? 3)
            if (userType === 1) return true
            if (!profile?.fms_type) return false

            const folder = NavFolders.find(item => item.items?.some(group =>
                group.children.some(child => link === child.url || link.startsWith(`${child.url}/`))))
            if (folder && !folder.fmsTypes?.includes(profile.fms_type)) return false

            const rawPermissions = getValue('UserPermission')
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


// 'use client'

// import { useMemo } from 'react'
// import { useGlobalContext } from '@/lib/context/GlobalContext'

// interface Permission {
//     ilink: string
//     is_visible: boolean
// }

// export const usePermission = (
//     link: string
// ): boolean | null => {

//     const { getValue } = useGlobalContext()

//     const hasPermission = useMemo(() => {
//         try {

//             const rawPermissions = getValue('UserPermission')

//             // still loading
//             if (rawPermissions == null) {
//                 return null
//             }

//             const permissions: Permission[] =
//                 typeof rawPermissions === 'string'
//                     ? JSON.parse(rawPermissions)
//                     : rawPermissions || []

//             const permission = permissions.find(
//                 (p) => p.ilink === link
//             )

//             return Boolean(permission?.is_visible)

//         } catch {
//             return null
//         }

//     }, [getValue, link])

//     // null = still loading
//     if (hasPermission === null) {
//         return null
//     }

//     // true = no permission
//     return !hasPermission
// }
