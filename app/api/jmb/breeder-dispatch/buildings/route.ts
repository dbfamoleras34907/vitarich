import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { admin_db } from "@/lib/Supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DispatchLineRow = {
  dispatch_id: number | string | null;
  building_name: string | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load dispatch buildings.";
}

function accessToken(request: Request) {
  const [scheme, token] = (request.headers.get("authorization") ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : "";
}

function dispatchIds(value: unknown) {
  if (!Array.isArray(value) || value.length > 1_000) throw new Error("Choose valid dispatch records.");
  const ids = [...new Set(value.map(Number))];
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error("Choose valid dispatch records.");
  return ids;
}

export async function POST(request: Request) {
  try {
    const token = accessToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { data: authData, error: authError } = await admin_db.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const ids = dispatchIds((await request.json() as { dispatchIds?: unknown }).dispatchIds);
    if (!ids.length) return NextResponse.json({ data: [] }, { headers: { "Cache-Control": "no-store" } });

    const scopedDb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: visibleDispatches, error: visibleError } = await scopedDb
      .from("brd_dispatch_register")
      .select("id")
      .in("id", ids);
    if (visibleError) throw visibleError;

    const visibleIds = (visibleDispatches ?? []).map((row) => Number(row.id)).filter((id) => Number.isSafeInteger(id) && id > 0);
    if (!visibleIds.length) return NextResponse.json({ data: [] }, { headers: { "Cache-Control": "no-store" } });

    const lines: DispatchLineRow[] = [];
    for (let offset = 0; ; offset += 1_000) {
      const { data, error } = await admin_db
        .from("tbl_brd_dispatch_line")
        .select("dispatch_id, building_name")
        .in("dispatch_id", visibleIds)
        .order("id", { ascending: true })
        .range(offset, offset + 999);
      if (error) throw error;
      lines.push(...((data ?? []) as DispatchLineRow[]));
      if ((data?.length ?? 0) < 1_000) break;
    }

    const buildingNamesByDispatch = new Map<number, string[]>();
    lines.forEach((line) => {
      const dispatchId = Number(line.dispatch_id);
      const buildingName = String(line.building_name ?? "").trim();
      if (!Number.isSafeInteger(dispatchId) || dispatchId <= 0 || !buildingName) return;
      const names = buildingNamesByDispatch.get(dispatchId) ?? [];
      if (!names.includes(buildingName)) names.push(buildingName);
      buildingNamesByDispatch.set(dispatchId, names);
    });

    return NextResponse.json({
      data: visibleIds.map((dispatchId) => ({ dispatch_id: dispatchId, building_names: buildingNamesByDispatch.get(dispatchId) ?? [] })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
