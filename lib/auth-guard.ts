import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "./Supabase/supabaseClient";
import { NavFolders } from "./Defaults/DefaultValues";
import { getNavigationPermissionTitle } from "./sidebar/navigationPermissions";

export async function checkAuth() {
    const headerList = await headers();
    const pathname = headerList.get("x-current-path") || "/";
    const publicRoutes = ["/", "/login"];
    if (publicRoutes.includes(pathname)) return null;

    const { data: { user } } = await db.auth.getUser();
    if (!user) {
        redirect("/login");
    }

    const { data: userPermissions } = await db
        .from('user_permissions')
        .select('group_name, title, is_visible,ilink')
        .eq('user_id', user.id);

    const { data: profile } = await db
        .from('users')
        .select('user_type, fms_type')
        .eq('auth_id', user.id)
        .maybeSingle();

    let activeModule: { group: string; title: string; view?: boolean } | null = null;
    for (const folder of NavFolders) {
        for (const item of folder.items || []) {
            const match = item.children.find((child) => child.url === pathname);
            if (match) {
                activeModule = {
                    group: item.group,
                    title: match.title,
                    view: match.view,
                };
                break;
            }
        }
    }

    if (activeModule) {
        const folder = NavFolders.find(item => item.items?.some(group =>
            group.group === activeModule.group &&
            group.children.some(child => child.title === activeModule.title)));
        const userType = Number(profile?.user_type ?? 3);
        const hasFmsAccess = userType === 1 || Boolean(
            profile?.fms_type && folder?.fmsTypes?.includes(profile.fms_type as "Broiler" | "Breeder" | "Hatchery")
        );
        const hasPermission = userType === 1 || (hasFmsAccess && userPermissions?.some(
            (p) =>
                p.group_name === activeModule.group &&
                p.title === getNavigationPermissionTitle(activeModule) &&
                p.is_visible
        ));

        if (!hasPermission) {
            redirect("/404");
        }
    }
    return { user, userPermissions };
}
