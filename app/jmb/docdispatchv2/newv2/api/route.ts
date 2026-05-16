export const runtime = "nodejs";

import { admin_db } from "@/lib/Supabase/supabaseAdmin";
import { NextResponse } from "next/server";
import type { DispatchDocUpsertPayload } from "@/app/jmb/docdispatchv2/newv2/api";

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme.toLowerCase() !== "bearer" || !token) {
    throw new Error("Missing authorization token.");
  }

  return token;
}

async function getRequestUserId(req: Request) {
  const token = getBearerToken(req);
  const {
    data: { user },
    error,
  } = await admin_db.auth.getUser(token);

  if (error || !user) {
    throw error ?? new Error("Invalid authorization token.");
  }

  return user.id;
}

function jsonError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Request failed.";

  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const userId = await getRequestUserId(req);
    const payload = (await req.json()) as DispatchDocUpsertPayload;
    const { items, ...header } = payload;

    const { data: inserted, error } = await admin_db
      .from("dispatch_doc")
      .insert({
        ...header,
        is_active: true,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) throw error;

    if (items?.length) {
      const { error: itemErr } = await admin_db
        .from("dispatch_doc_item")
        .insert(
          items.map((it) => ({
            dispatch_doc_id: inserted.id,
            created_by: userId,
            ...it,
          })),
        );

      if (itemErr) throw itemErr;
    }

    return NextResponse.json({ id: inserted.id });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const userId = await getRequestUserId(req);
    const { id, payload } = (await req.json()) as {
      id: number;
      payload: DispatchDocUpsertPayload;
    };
    const { items, ...header } = payload;

    const { error: headerErr } = await admin_db
      .from("dispatch_doc")
      .update({
        ...header,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", id);

    if (headerErr) throw headerErr;

    const { error: deleteErr } = await admin_db
      .from("dispatch_doc_item")
      .delete()
      .eq("dispatch_doc_id", id);

    if (deleteErr) throw deleteErr;

    if (items?.length) {
      const { error: itemErr } = await admin_db
        .from("dispatch_doc_item")
        .insert(
          items.map((it) => ({
            dispatch_doc_id: id,
            created_by: userId,
            ...it,
          })),
        );

      if (itemErr) throw itemErr;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getRequestUserId(req);
    const { id } = (await req.json()) as { id: number };

    const { error } = await admin_db
      .from("dispatch_doc")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
