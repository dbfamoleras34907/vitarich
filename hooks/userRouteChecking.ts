// 'use client'

// import { usePermission } from "@/hooks/usePermission";

// export const useRouteChecking = () => {
//     const routePermissions = {
//         RECEIVING: usePermission("/a_dean/receiving/view"),
//         CLASSIFICATION: usePermission("/jmb/hatcheryclassi/view"),
//         STORAGE: usePermission("/jmb/eggstorage/view"),
//         PRE_WARMING: usePermission("/jmb/prewarmingv2/view"),
//         SETTER: usePermission("/jmb/eggsetter/view"),
//         TRANSFER: usePermission("/jmb/eggtransferv2/view"),
//         HATCHER: usePermission("/jmb/egghatcherv2/view"),
//         PULLOUT: usePermission("/jmb/chickpulloutv2/view"),
//     };

//     const checkRoute = (route: string): boolean => {
//         return routePermissions[
//             route as keyof typeof routePermissions
//         ] ?? false;
//     };
//     console.log("Route permissions:", routePermissions, checkRoute);
//     return { checkRoute };
// };