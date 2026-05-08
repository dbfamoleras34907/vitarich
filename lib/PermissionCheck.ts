import { getSessionUser } from "./Defaults/GlobalDefaults";

// export async function PermissionCheck(link: string) {

//     const user = await getSessionUser();
//     if (!user) {
//         console.warn("No active session found.");
//         return;
//     }
//     console.log( user)
//     return false
// }

export const PermissionCheck = async (link: string) => {
    const user = await getSessionUser();
    if (!user) {
        console.warn("No active session found.");
        return;
    }
    console.log(user)
    return false
}