import { db } from "@/lib/Supabase/supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";



export async function toggleUserPermission(
  userId: string,
  groupName: string,
  title: string,
  checked: boolean,
  url?: string,
  type?: string,

) {
  try {
    const { data, error } = await db
      .from("user_permissions")
      .upsert(
        {
          user_id: userId,
          group_name: groupName,
          title,
          is_visible: checked,
          updated_by: userId,
          ilink: url || "",
          updated_at: new Date().toISOString(),
          type: type
        },
        { onConflict: "user_id,group_name,title" }
      )
      .select();

    if (error) throw error;
    toast.success(`Permission ${checked ? "granted" : "revoked"}: ${groupName} - ${title}`);
    console.log("Permission updated:", data);
    return data;
  } catch (err) {
    console.log("Error updating permission:", err);
    toast.success(`Only [Super user] can update user permissions`);

    // throw err;
  }
}



export async function getUserPermissions(userId: string) {
  try {
    const { data, error } = await db
      .from("user_permissions")
      .select("group_name, title, is_visible,ilink")
      .eq("user_id", userId)
      .eq("is_visible", true);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.log("Error fetching user permissions:", err);
    throw err;
  }
}





export async function getvwdmf_get_farmlist_code_name_farmtype() {
  try {
    const { data, error } = await db
      .from("vwdmf_get_farmlist_code_name_farmtype")
      .select("*")
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.log(err);
    throw err;
  }
}

export async function get_vwdmf_super_users() {
  try {
    const { data, error } = await db
      .from("vwdmf_super_users")
      .select("*")
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.log(err);
    throw err;
  }
}


export async function getUserFarms(users_id: number) {
  console.log({ users_id })
  const { data, error } = await db.rpc("get_user_farms", {
    p_users_id: users_id,
  });
  console.log({ data, error })
  if (error) {
    console.error("RPC error:", error);
    return null;
  }

  return data;
}


export async function getPermissionTemplates() {
  const { data, error } = await db
    .from("permission_templates")
    .select(`
      id,
      template_name,
      remarks,
      created_at
    `)
    .eq("void", 0)
    .order("template_name", { ascending: true });

  console.log({ data, error });

  if (error) {
    console.error("Select error:", error);
    return null;
  }

  return data;
}

export async function createPermissionTemplate(
  template_name: string,
  permissions: Record<string, any>[]
) {

  const { data, error } = await db.rpc(
    "create_permission_template",
    {
      p_template_name: template_name,
      p_remarks: "",
      p_permissions: permissions,
    }
  )

  if (error) {

    if (
      error.message.includes("permission_templates_template_name_unique")
    ) {
      throw new Error("Template name already exists")
    }

    throw error
  }

  return data
}


export async function getPermissionTemplateItems(
  template_id: number
) {

  const { data, error } = await db
    .from("permission_template_items")
    .select("*")
    .eq("template_id", template_id)

  console.log({ data, error })

  if (error) {
    console.error(error)
    return []
  }

  return data
}