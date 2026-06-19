import { db } from "@/lib/Supabase/supabaseClient";
import { createClient } from "@supabase/supabase-js";

const GROWING_TABLE = "tbl_growing";
const FEEDTYPE_TABLE = "tbl_feedtype";
const PLACEMENT_TABLE = "tbl_placement";

const feedTypeDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  },
);

function throwDbError(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}) {
  const message =
    [error.message, error.details, error.hint, error.code]
      .filter(Boolean)
      .join("\n") || "Database request failed.";
  throw new Error(message);
}

export type FeedType = {
  id: number;
  description: string | null;
  uom: string | null;
  isactive: boolean;
};

export type Growing = {
  id: number;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
  placement_id: number | null;
  daterec: string | null;
  male_mortality: number | null;
  male_feedtype_id: number | null;
  male_feed_consumption: number | null;
  male_body_weight: number | null;
  female_mortality: number | null;
  female_feedtype_id: number | null;
  female_feed_consumption: number | null;
  female_body_weight: number | null;
  isactive: boolean;
  placement?: GrowingPlacement | null;
  male_feedtype?: Pick<FeedType, "description" | "uom"> | null;
  female_feedtype?: Pick<FeedType, "description" | "uom"> | null;
};

export type GrowingInsert = Omit<
  Growing,
  | "id"
  | "created_at"
  | "created_by"
  | "updated_at"
  | "updated_by"
  | "placement"
  | "male_feedtype"
  | "female_feedtype"
>;

export type GrowingUpdate = Partial<GrowingInsert>;

export type GrowingPlacement = {
  id: number;
  placement_date: string;
  dr_no: string | null;
  farm_id?: number | null;
  farm_name: string | null;
  building_no: string | null;
  pen_no: string | null;
  f_endingbalance?: number | null;
  m_endingbalance?: number | null;
};

export type GrowingFarmHistory = {
  record_date: string | null;
  farm: string | null;
  building: string | null;
  pen: string | null;
  age: number | null;
  week_no: string | null;
  female_mortality: number | null;
  female_feed: number | null;
  female_feed_type: string | null;
  female_body_weight: number | null;
  male_mortality: number | null;
  male_feed: number | null;
  male_feed_type: string | null;
  male_body_weight: number | null;
};

const growingSelect = `
  *,
  placement:tbl_placement!fk_tbl_growing_placement(
    id,
    placement_date,
    dr_no,
    farm_id,
    farm_name,
    building_no,
    pen_no,
    f_endingbalance,
    m_endingbalance
  )
`;

async function hydrateFeedTypes(rows: Growing[]) {
  const feedTypeIds = Array.from(
    new Set(
      rows.flatMap((row) =>
        [row.male_feedtype_id, row.female_feedtype_id].filter(
          (id): id is number => typeof id === "number",
        ),
      ),
    ),
  );

  if (!feedTypeIds.length) return rows;

  const { data, error } = await feedTypeDb
    .from(FEEDTYPE_TABLE)
    .select("id, description, uom")
    .in("id", feedTypeIds);

  if (error) throwDbError(error);

  const feedTypeById = new Map(
    (data ?? []).map((feedType) => [Number(feedType.id), feedType]),
  );

  return rows.map((row) => ({
    ...row,
    male_feedtype:
      row.male_feedtype_id != null
        ? (feedTypeById.get(row.male_feedtype_id) ?? null)
        : null,
    female_feedtype:
      row.female_feedtype_id != null
        ? (feedTypeById.get(row.female_feedtype_id) ?? null)
        : null,
  })) as Growing[];
}

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await db.auth.getSession();

  if (error) throwDbError(error);
  if (!session?.access_token) {
    throw new Error("Your session expired. Please log in again.");
  }

  return session.access_token;
}

async function growingWriteRequest<T>(body: Record<string, unknown>) {
  const token = await getAccessToken();
  const response = await fetch("/api/jmb/growing", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(result.error || "Failed to save growing.");
  }

  if (result.data == null) throw new Error("No growing data was returned.");
  return result.data;
}

export async function listGrowings() {
  const { data, error } = await db
    .from(GROWING_TABLE)
    .select(growingSelect)
    .eq("isactive", true)
    .order("daterec", { ascending: false })
    .order("id", { ascending: false });

  if (error) throwDbError(error);
  return hydrateFeedTypes((data ?? []) as Growing[]);
}

export async function listGrowingHistoryByFarm(params: {
  farmId?: number | null;
  farmName?: string | null;
  buildingNo?: string | null;
}) {
  const token = await getAccessToken();
  const searchParams = new URLSearchParams({ type: "history" });

  if (params.farmName?.trim()) {
    searchParams.set("farmName", params.farmName.trim());
  }

  if (params.buildingNo?.trim()) {
    searchParams.set("buildingNo", params.buildingNo.trim());
  }

  const response = await fetch(`/api/jmb/growing?${searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const result = (await response.json().catch(() => ({}))) as {
    data?: GrowingFarmHistory[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(result.error || "Failed to load history.");
  }

  return result.data ?? [];
}

export async function getGrowingById(id: number) {
  const { data, error } = await db
    .from(GROWING_TABLE)
    .select(growingSelect)
    .eq("id", id)
    .single();

  if (error) throwDbError(error);
  const [row] = await hydrateFeedTypes([data as Growing]);
  return row;
}

export async function createGrowing(payload: GrowingInsert) {
  const data = await growingWriteRequest<Growing>({
    action: "create",
    payload,
  });
  const [row] = await hydrateFeedTypes([data]);
  return row;
}

export async function createGrowingBatch(payloads: GrowingInsert[]) {
  const data = await growingWriteRequest<Growing[]>({
    action: "createBatch",
    payloads,
  });
  return hydrateFeedTypes(data);
}

export async function updateGrowing(id: number, payload: GrowingUpdate) {
  const data = await growingWriteRequest<Growing>({
    action: "update",
    id,
    payload,
  });
  const [row] = await hydrateFeedTypes([data]);
  return row;
}

export async function deleteGrowing(id: number) {
  const { error } = await db
    .from(GROWING_TABLE)
    .update({
      isactive: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throwDbError(error);
  return true;
}

export async function listFeedTypes() {
  const { data, error } = await feedTypeDb
    .from(FEEDTYPE_TABLE)
    .select("id, description, uom, isactive")
    .not("description", "is", null)
    .order("description", { ascending: true });

  if (error) throwDbError(error);
  return (data ?? []).filter((row) => row.description?.trim()) as FeedType[];
}

export async function listGrowingPlacements() {
  const { data, error } = await db
    .from(PLACEMENT_TABLE)
    .select(
      "id, placement_date, dr_no, farm_id, farm_name, building_no, pen_no, f_endingbalance, m_endingbalance",
    )
    .not("farm_name", "is", null)
    .not("building_no", "is", null)
    .order("farm_name", { ascending: true })
    .order("building_no", { ascending: true })
    .order("pen_no", { ascending: true })
    .order("placement_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) throwDbError(error);
  return (data ?? []) as GrowingPlacement[];
}

export async function getGrowingPlacementById(id: number) {
  const { data, error } = await db
    .from(PLACEMENT_TABLE)
    .select(
      "id, placement_date, dr_no, farm_id, farm_name, building_no, pen_no, f_endingbalance, m_endingbalance",
    )
    .eq("id", id)
    .single();

  if (error) throwDbError(error);
  return data as GrowingPlacement;
}
