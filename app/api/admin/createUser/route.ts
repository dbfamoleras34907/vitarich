// app/api/admin/createUser/route.ts
export const runtime = "nodejs";
import { admin_db } from "@/lib/Supabase/supabaseAdmin";
import { NextResponse } from "next/server";
import { USER_TYPE, adminAccessError, requireAdminActor } from "@/lib/auth/adminAccess";

export async function POST(req: Request) {
  try {
    const actor = await requireAdminActor(req);
    const { email, password } = await req.json();
    const { data, error } = await admin_db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,  
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (data.user?.id) {
      const { error: profileError } = await admin_db.from("users").upsert({
        auth_id: data.user.id,
        email: data.user.email,
        user_type: USER_TYPE.USER,
        issuper: "0",
        fms_type: actor.user_type === USER_TYPE.ADMIN ? actor.fms_type : null,
        created_by: actor.auth_id,
      }, { onConflict: "auth_id" });
      if (profileError) {
        await admin_db.auth.admin.deleteUser(data.user.id);
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
    }
    return NextResponse.json({ user: data.user }, { status: 200 });
  } catch (err: unknown) {
    console.error("API Error:", err);
    const response = adminAccessError(err);
    return NextResponse.json(
      { error: response.message },
      { status: response.status }
    );
  }
}
