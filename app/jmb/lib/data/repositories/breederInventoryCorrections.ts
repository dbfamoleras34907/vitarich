import { db } from "@/lib/Supabase/supabaseClient";

type PlacementOpeningBalance = {
  id: number;
  m_endingbalance: number | null;
  m_beg: number;
  m_doa: number;
  m_reject: number;
  m_shortcount: number;
  f_endingbalance: number | null;
  f_beg: number;
  f_doa: number;
  f_reject: number;
  f_shortcount: number;
};

type InventoryCorrection = {
  placement_id: number;
  male_delta: number;
  female_delta: number;
};

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function applyPostedFemaleInventoryCorrections<T extends PlacementOpeningBalance>(
  placements: T[],
) {
  const placementIds = Array.from(new Set(placements.map((placement) => Number(placement.id))))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!placementIds.length) return placements;

  const { data, error } = await db
    .from("tbl_breeder_inventory_correction")
    .select("placement_id, male_delta, female_delta")
    .in("placement_id", placementIds)
    .eq("status", "Posted");
  let corrections = data as InventoryCorrection[] | null;
  if (error?.code === "PGRST204") {
    // The initial deployment had Female-only columns. Keep placement pages
    // available until the additive Male migration has been run.
    const fallback = await db
      .from("tbl_breeder_inventory_correction")
      .select("placement_id, female_delta")
      .in("placement_id", placementIds)
      .eq("status", "Posted");
    if (fallback.error?.code === "PGRST205") return placements;
    if (fallback.error) throw fallback.error;
    corrections = (fallback.data ?? []).map((correction) => ({
      placement_id: Number(correction.placement_id),
      male_delta: 0,
      female_delta: Number(correction.female_delta ?? 0),
    }));
  } else if (error?.code === "PGRST205") {
    return placements;
  } else if (error) {
    throw error;
  }

  const deltaByPlacement = new Map<number, { male: number; female: number }>();
  (corrections ?? []).forEach((correction) => {
    const placementId = Number(correction.placement_id);
    const current = deltaByPlacement.get(placementId) ?? { male: 0, female: 0 };
    current.male += number(correction.male_delta);
    current.female += number(correction.female_delta);
    deltaByPlacement.set(placementId, current);
  });

  return placements.map((placement) => {
    const startingMale = placement.m_endingbalance ??
      number(placement.m_beg) - number(placement.m_doa) - number(placement.m_reject) - number(placement.m_shortcount);
    const startingFemale = placement.f_endingbalance ??
      number(placement.f_beg) - number(placement.f_doa) - number(placement.f_reject) - number(placement.f_shortcount);
    const delta = deltaByPlacement.get(Number(placement.id)) ?? { male: 0, female: 0 };
    return {
      ...placement,
      m_endingbalance: startingMale + delta.male,
      f_endingbalance: startingFemale + delta.female,
    };
  });
}
