export const runtime = "nodejs";

import { admin_db } from "@/lib/Supabase/supabaseAdmin";
import { NextResponse } from "next/server";
import type { DispatchDocUpsertPayload } from "@/app/jmb/docdispatchv2/newv2/api";
import {
  createHatcheryDocDispatchDraft,
  deleteHatcheryDocDispatchDraft,
  postHatcheryDocDispatch,
  requireHatcheryDocDispatchAccess,
  updateHatcheryDocDispatchDraft,
} from "@/lib/data/repositories/hatcheryDocDispatch.server";

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

  return NextResponse.json({ error: message === "FORBIDDEN" ? "Forbidden." : message }, { status: message === "FORBIDDEN" ? 403 : status });
}

function requiredId(value: unknown) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("A valid DOC Dispatch ID is required.");
  return id;
}

export async function POST(req: Request) {
  try {
    const userId = await getRequestUserId(req);
    await requireHatcheryDocDispatchAccess(userId, "insert");
    const payload = (await req.json()) as DispatchDocUpsertPayload;
    const id = await createHatcheryDocDispatchDraft(payload, userId);
    return NextResponse.json({ id });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(req: Request) {
  try {
    const userId = await getRequestUserId(req);
    await requireHatcheryDocDispatchAccess(userId, "edit");
    const body = (await req.json()) as {
      id: unknown;
      payload: DispatchDocUpsertPayload;
    };
    await updateHatcheryDocDispatchDraft(requiredId(body.id), body.payload, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await getRequestUserId(req);
    await requireHatcheryDocDispatchAccess(userId, "edit");
    const { id } = (await req.json()) as { id: unknown };
    const result = await postHatcheryDocDispatch(requiredId(id), userId);
    return NextResponse.json({ success: true, dispatch: result });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getRequestUserId(req);
    await requireHatcheryDocDispatchAccess(userId, "edit");
    const { id } = (await req.json()) as { id: unknown };
    await deleteHatcheryDocDispatchDraft(requiredId(id), userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
