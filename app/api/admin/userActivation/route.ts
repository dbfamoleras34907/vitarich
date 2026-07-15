export const runtime = "nodejs";

import { admin_db } from "@/lib/Supabase/supabaseAdmin";
import { NextResponse } from "next/server";

function isInactive(value: unknown) {
  return value === null || value === undefined || String(value).trim() !== "1";
}

export async function GET() {
  try {
    const { data, error } = await admin_db
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      users: (data ?? []).filter((user) => isInactive(user.isactive)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("User activation GET error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, approvedBy } = await req.json();
    const numericUserId = Number(userId);

    if (!Number.isFinite(numericUserId)) {
      return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
    }

    const { data, error } = await admin_db
      .from("users")
      .update({
        isactive: 1,
        docStatus: "Active",
        updated_by: approvedBy || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", numericUserId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ user: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("User activation POST error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
