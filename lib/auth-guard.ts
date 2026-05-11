import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "./Supabase/supabaseClient";
import { NavFolders } from "./Defaults/DefaultValues";

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

    let activeModuleTitle: string | null = null;
    for (const folder of NavFolders) {
        for (const item of folder.items || []) {
            const match = item.children.find((child) => child.url === pathname);
            if (match) {
                activeModuleTitle = match.title;
                break;
            }
        }
    }

    if (activeModuleTitle) {
        const hasPermission = userPermissions?.some(
            (p) => p.title === activeModuleTitle && p.is_visible
        );

        if (!hasPermission) {
            redirect("/404");
        }
    }
    return { user, userPermissions };
}