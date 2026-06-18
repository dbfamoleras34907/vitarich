// 'use client'

// import { useEffect } from 'react'
// import { useRouter, useSearchParams } from 'next/navigation'
// import { usePermission } from '@/hooks/usePermission'

// export default function ValidatePage() {
//     const router = useRouter()
//     const searchParams = useSearchParams()

//     const route = searchParams.get('route')
//     const id = searchParams.get('id')

//     const viewRoutes: Record<string, string> = {
//         CLASSIFICATION: '/jmb/hatcheryclassi/view/',
//         STORAGE: '/jmb/eggstorage/view/',
//         PRE_WARMING: '/jmb/prewarmingv2/view/',
//         SETTER: '/jmb/eggsetter/view/',
//         TRANSFER: '/jmb/eggtransferv2/view/',
//         HATCHER: '/jmb/egghatcherv2/view/',
//         PULLOUT: '/jmb/chickpulloutv2/view/',
//         RECEIVING: '/a_dean/receiving/view/',
//     }

//     const routePermissions = {
//         RECEIVING: usePermission('/a_dean/receiving/view'),
//         CLASSIFICATION: usePermission('/jmb/hatcheryclassi/view'),
//         STORAGE: usePermission('/jmb/eggstorage/view'),
//         PRE_WARMING: usePermission('/jmb/prewarmingv2/view'),
//         SETTER: usePermission('/jmb/eggsetter/view'),
//         TRANSFER: usePermission('/jmb/eggtransferv2/view'),
//         HATCHER: usePermission('/jmb/egghatcherv2/view'),
//         PULLOUT: usePermission('/jmb/chickpulloutv2/view'),
//     }

//     useEffect(() => {
//         if (!route || !id) {
//             router.replace('/404')
//             return
//         }

//         const hasPermission =
//             routePermissions[
//             route as keyof typeof routePermissions
//             ] ?? false

//         if (hasPermission) {
//             alert('You do not have permission')
//             window.close()
//             return
//         }

//         const targetRoute = viewRoutes[route]

//         if (!targetRoute) {
//             router.replace('/404')
//             return
//         }

//         router.replace(`${targetRoute}${id}`)
//     }, [route, id])

//     return <div>Validating access...</div>
// }


'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePermission } from '@/hooks/usePermission'

export default function ValidatePage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const route = searchParams.get('route')
    const id = searchParams.get('id')
    const action = searchParams.get('action') || 'view'

    // VIEW ROUTES
    const viewRoutes: Record<string, string> = {
        RECEIVING: '/a_dean/receiving/view/',
        CLASSIFICATION: '/jmb/hatcheryclassi/view/',
        STORAGE: '/jmb/eggstorage/view/',
        PRE_WARMING: '/jmb/prewarmingv2/view/',
        SETTER: '/jmb/eggsetter/view/',
        TRANSFER: '/jmb/eggtransferv2/view/',
        HATCHER: '/jmb/egghatcherv2/view/',
        PULLOUT: '/jmb/chickpulloutv2/view/',
    }

    // VOID ROUTES
    const voidRoutes: Record<string, string> = {
        RECEIVING: '/a_dean/receiving/void/',
        CLASSIFICATION: '/jmb/hatcheryclassi/void/',
        STORAGE: '/jmb/eggstorage/void/',
        SETTER: '/jmb/eggsetter/void/',
        PRE_WARMING: '/jmb/prewarmingv2/void/',
        TRANSFER: '/jmb/eggtransferv2/void/',
        HATCHER: '/jmb/egghatcherv2/void/',
        PULLOUT: '/jmb/chickpulloutv2/void/',
    }

    // VIEW PERMISSIONS
    const viewPermissions = {
        RECEIVING: usePermission('/a_dean/receiving/view'),
        CLASSIFICATION: usePermission('/jmb/hatcheryclassi/view'),
        STORAGE: usePermission('/jmb/eggstorage/view'),
        PRE_WARMING: usePermission('/jmb/prewarmingv2/view'),
        SETTER: usePermission('/jmb/eggsetter/view'),
        TRANSFER: usePermission('/jmb/eggtransferv2/view'),
        HATCHER: usePermission('/jmb/egghatcherv2/view'),
        PULLOUT: usePermission('/jmb/chickpulloutv2/view'),
    }

    // VOID PERMISSIONS
    const voidPermissions = {
        RECEIVING: usePermission('/a_dean/receiving/void'),
        CLASSIFICATION: usePermission('/jmb/hatcheryclassi/void'),
        STORAGE: usePermission('/jmb/eggstorage/void'),
        PRE_WARMING: usePermission('/jmb/prewarmingv2/void'),
        SETTER: usePermission('/jmb/eggsetter/void'),
        TRANSFER: usePermission('/jmb/eggtransferv2/void'),
        HATCHER: usePermission('/jmb/egghatcherv2/void'),
        PULLOUT: usePermission('/jmb/chickpulloutv2/void'),
    }

    useEffect(() => {
        if (!route || !id) {
            window.close()
            return
        }

        const permissions =
            action === 'void'
                ? voidPermissions
                : viewPermissions

        const routes =
            action === 'void'
                ? voidRoutes
                : viewRoutes

        const hasPermission =
            permissions[
                route as keyof typeof permissions
            ] ?? false

        if (!hasPermission) {
            alert(`No permission to ${action}`)
            window.close()
            return
        }

        const targetRoute = routes[route]

        if (!targetRoute) {
            window.close()
            return
        }

        router.replace(`${targetRoute}${id}`)
    }, [route, id, action])

    return <div>Validating access...</div>
}