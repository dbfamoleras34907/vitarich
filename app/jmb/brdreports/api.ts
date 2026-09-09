import { db } from "@/lib/Supabase/supabaseClient";

const PLACEMENT_TABLE = "tbl_placement";
const PERFORMANCE_TABLE = "tbl_breeder_daily_performance";

type PlacementRow = {
  id: number;
  cycle_id: number | null;
  placement_date: string;
  farm_id: number;
  farm_name: string;
  building_id: number;
  building_no: string;
  pen_id: number;
  pen_no: string;
};

type PerformanceRow = {
  id: number;
  placement_id: number;
  daterec: string;
  inv_male: number | null;
  inv_female: number | null;
  mc_male: number | null;
  mc_female: number | null;
  avg_body_weight_male: number | null;
  avg_body_weight_female: number | null;
  feed_consumption_male: number | null;
  feed_consumption_female: number | null;
};

export type MortalityReportRow = {
  id: number;
  placementId: number;
  placementDate: string;
  recordDate: string;
  farmId: number;
  farmName: string;
  buildingId: number;
  buildingName: string;
  penId: number;
  penName: string;
  cycleNumber: number | null;
  inventoryMale: number;
  inventoryFemale: number;
  mortalityMale: number;
  mortalityFemale: number;
  averageWeightMale: number;
  averageWeightFemale: number;
  feedConsumptionMale: number;
  feedConsumptionFemale: number;
};

export type RegradingReportRow = {
  id: number;
  recordDate: string;
  placementDate: string;
  farmName: string;
  buildingName: string;
  penName: string;
  cycleNumber: number | null;
  maleOld: number;
  maleNew: number;
  femaleOld: number;
  femaleNew: number;
  remarks: string;
};

export type VaccinationReportRow = {
  id: number;
  documentNo: string;
  recordDate: string;
  farmName: string;
  scope: string;
  buildingName: string;
  targetNames: string;
  vaccine: string;
  diseaseTarget: string;
  dosage: number;
  unit: string;
  route: string;
  birdsBefore: number;
  birdsVaccinated: number;
  birdsMissed: number;
  batchNumber: string;
  expiryDate: string;
  nextDoseDate: string;
  cycleNumber: number | null;
};

export type MedicationReportRow = {
  id: number;
  documentNo: string;
  recordDate: string;
  treatmentEndDate: string;
  farmName: string;
  scope: string;
  buildingName: string;
  targetNames: string;
  medication: string;
  medicationType: string;
  indication: string;
  dosage: number;
  unit: string;
  route: string;
  treatmentDays: number;
  prescribedBy: string;
  administeredBy: string;
  cycleNumber: number | null;
};

export type MortalityReportFilters = {
  farmId: number;
  cycleNumber?: number | null;
  buildingId?: number | null;
  penId?: number | null;
  dateFrom: string;
  dateTo: string;
};

async function cycleIdsForFilters(filters: MortalityReportFilters) {
  if (!filters.cycleNumber) return null;
  let query = db.from("tbl_breeder_cycle").select("id").eq("farm_id", filters.farmId).eq("cycle_no", filters.cycleNumber);
  if (filters.buildingId) query = query.eq("building_id", filters.buildingId);
  if (filters.penId) query = query.eq("pen_id", filters.penId);
  const { data, error } = await query;
  if (error) throw new Error(errorMessage(error));
  return (data ?? []).map((row) => Number(row.id));
}

async function cycleNumberMap(placements: PlacementRow[]) {
  const ids = [...new Set(placements.map((row) => Number(row.cycle_id ?? 0)).filter((id) => id > 0))];
  if (!ids.length) return new Map<number, number>();
  const { data, error } = await db.from("tbl_breeder_cycle").select("id, cycle_no").in("id", ids);
  if (error) throw new Error(errorMessage(error));
  return new Map((data ?? []).map((row) => [Number(row.id), Number(row.cycle_no)]));
}

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Database request failed.");
  }
  return "Database request failed.";
}

export async function listMortalityReport(filters: MortalityReportFilters) {
  const cycleIds = await cycleIdsForFilters(filters);
  if (cycleIds && !cycleIds.length) return [];
  let placementQuery = db
    .from(PLACEMENT_TABLE)
    .select(
      "id, cycle_id, placement_date, farm_id, farm_name, building_id, building_no, pen_id, pen_no",
    )
    .eq("farm_id", filters.farmId);

  if (filters.buildingId) placementQuery = placementQuery.eq("building_id", filters.buildingId);
  if (filters.penId) placementQuery = placementQuery.eq("pen_id", filters.penId);
  if (cycleIds) placementQuery = placementQuery.in("cycle_id", cycleIds);

  const { data: placementData, error: placementError } = await placementQuery;
  if (placementError) throw new Error(errorMessage(placementError));

  const placements = (placementData ?? []) as PlacementRow[];
  if (!placements.length) return [];
  const cyclesById = await cycleNumberMap(placements);

  const placementById = new Map(placements.map((row) => [Number(row.id), row]));
  const placementIds = [...placementById.keys()];
  const performanceRows: PerformanceRow[] = [];

  // Keep the generated Supabase URL at a safe size on farms with many historical placements.
  for (let index = 0; index < placementIds.length; index += 300) {
    const ids = placementIds.slice(index, index + 300);
    const { data, error } = await db
      .from(PERFORMANCE_TABLE)
      .select("id, placement_id, daterec, inv_male, inv_female, mc_male, mc_female, avg_body_weight_male, avg_body_weight_female, feed_consumption_male, feed_consumption_female")
      .in("placement_id", ids)
      .eq("isactive", true)
      .gte("daterec", filters.dateFrom)
      .lte("daterec", filters.dateTo)
      .order("daterec", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw new Error(errorMessage(error));
    performanceRows.push(...((data ?? []) as PerformanceRow[]));
  }

  return performanceRows
    .map((row): MortalityReportRow | null => {
      const placement = placementById.get(Number(row.placement_id));
      if (!placement) return null;
      return {
        id: Number(row.id),
        placementId: Number(row.placement_id),
        placementDate: placement.placement_date,
        recordDate: row.daterec,
        farmId: Number(placement.farm_id),
        farmName: placement.farm_name || "Unspecified farm",
        buildingId: Number(placement.building_id),
        buildingName: placement.building_no || "Unspecified building",
        penId: Number(placement.pen_id),
        penName: placement.pen_no || "Unspecified pen",
        cycleNumber: placement.cycle_id ? cyclesById.get(Number(placement.cycle_id)) ?? filters.cycleNumber ?? null : null,
        inventoryMale: number(row.inv_male),
        inventoryFemale: number(row.inv_female),
        mortalityMale: number(row.mc_male),
        mortalityFemale: number(row.mc_female),
        averageWeightMale: number(row.avg_body_weight_male),
        averageWeightFemale: number(row.avg_body_weight_female),
        feedConsumptionMale: number(row.feed_consumption_male),
        feedConsumptionFemale: number(row.feed_consumption_female),
      };
    })
    .filter((row): row is MortalityReportRow => row !== null)
    .sort(
      (left, right) =>
        left.farmName.localeCompare(right.farmName) ||
        left.buildingName.localeCompare(right.buildingName, undefined, { numeric: true }) ||
        left.penName.localeCompare(right.penName, undefined, { numeric: true }) ||
        left.recordDate.localeCompare(right.recordDate) ||
        left.id - right.id,
    );
}

async function reportPlacements(filters: MortalityReportFilters) {
  const cycleIds = await cycleIdsForFilters(filters);
  if (cycleIds && !cycleIds.length) return [];
  let query = db
    .from(PLACEMENT_TABLE)
    .select("id, cycle_id, placement_date, farm_id, farm_name, building_id, building_no, pen_id, pen_no")
    .eq("farm_id", filters.farmId);
  if (filters.buildingId) query = query.eq("building_id", filters.buildingId);
  if (filters.penId) query = query.eq("pen_id", filters.penId);
  if (cycleIds) query = query.in("cycle_id", cycleIds);
  const { data, error } = await query;
  if (error) throw new Error(errorMessage(error));
  return (data ?? []) as PlacementRow[];
}

export async function listRegradingReport(filters: MortalityReportFilters) {
  const placements = await reportPlacements(filters);
  if (!placements.length) return [];
  const cyclesById = await cycleNumberMap(placements);
  const placementById = new Map(placements.map((row) => [Number(row.id), row]));
  const results: RegradingReportRow[] = [];
  const ids = [...placementById.keys()];

  for (let index = 0; index < ids.length; index += 300) {
    const { data, error } = await db
      .from("tbl_grading")
      .select("id, placement_id, daterec, male_qty_old, male_qty_new, female_qty_old, female_qty_new, remarks")
      .in("placement_id", ids.slice(index, index + 300))
      .eq("isactive", true)
      .gte("daterec", filters.dateFrom)
      .lte("daterec", filters.dateTo)
      .order("daterec", { ascending: true });
    if (error) throw new Error(errorMessage(error));
    for (const row of data ?? []) {
      const placement = placementById.get(Number(row.placement_id));
      if (!placement) continue;
      results.push({
        id: Number(row.id),
        recordDate: String(row.daterec ?? ""),
        placementDate: placement.placement_date,
        farmName: placement.farm_name || "Unspecified farm",
        buildingName: placement.building_no || "Unspecified building",
        penName: placement.pen_no || "Unspecified pen",
        cycleNumber: placement.cycle_id ? cyclesById.get(Number(placement.cycle_id)) ?? filters.cycleNumber ?? null : null,
        maleOld: number(row.male_qty_old),
        maleNew: number(row.male_qty_new),
        femaleOld: number(row.female_qty_old),
        femaleNew: number(row.female_qty_new),
        remarks: String(row.remarks ?? ""),
      });
    }
  }
  return results.sort((left, right) => left.recordDate.localeCompare(right.recordDate) || left.id - right.id);
}

export async function listVaccinationReport(filters: MortalityReportFilters) {
  let query = db
    .from("brd_vaccination_register")
    .select("*")
    .eq("farm_id", filters.farmId)
    .eq("status", "Posted")
    .gte("vaccination_date", filters.dateFrom)
    .lte("vaccination_date", filters.dateTo)
    .order("vaccination_date", { ascending: true });
  if (filters.buildingId) query = query.eq("building_id", filters.buildingId);
  const { data, error } = await query;
  if (error) throw new Error(errorMessage(error));
  return (data ?? []).map((row): VaccinationReportRow => ({
    id: Number(row.id), documentNo: String(row.document_no ?? ""), recordDate: String(row.vaccination_date ?? ""),
    farmName: String(row.farm_name ?? ""), scope: String(row.scope ?? ""), buildingName: String(row.building_name ?? ""),
    targetNames: String(row.target_names ?? ""), vaccine: [row.vaccine_brand, row.vaccine_type].filter(Boolean).join(" - "),
    diseaseTarget: String(row.disease_target ?? ""), dosage: number(row.dosage), unit: String(row.unit ?? ""), route: String(row.route ?? ""),
    birdsBefore: number(row.birds_before), birdsVaccinated: number(row.birds_vaccinated), birdsMissed: number(row.birds_missed),
    batchNumber: String(row.batch_number ?? ""), expiryDate: String(row.expiry_date ?? ""), nextDoseDate: String(row.next_dose_date ?? ""),
    cycleNumber: filters.cycleNumber ?? null,
  }));
}

export async function listMedicationReport(filters: MortalityReportFilters) {
  let query = db
    .from("brd_medication_register")
    .select("*")
    .eq("farm_id", filters.farmId)
    .eq("status", "Posted")
    .gte("medication_date", filters.dateFrom)
    .lte("medication_date", filters.dateTo)
    .order("medication_date", { ascending: true });
  if (filters.buildingId) query = query.eq("building_id", filters.buildingId);
  const { data, error } = await query;
  if (error) throw new Error(errorMessage(error));
  return (data ?? []).map((row): MedicationReportRow => ({
    id: Number(row.id), documentNo: String(row.document_no ?? ""), recordDate: String(row.medication_date ?? ""),
    treatmentEndDate: String(row.treatment_end_date ?? ""), farmName: String(row.farm_name ?? ""), scope: String(row.scope ?? ""),
    buildingName: String(row.building_name ?? ""), targetNames: String(row.target_names ?? ""), medication: String(row.medication_brand ?? ""),
    medicationType: String(row.medication_type ?? ""), indication: String(row.indication ?? ""), dosage: number(row.dosage), unit: String(row.unit ?? ""),
    route: String(row.route ?? ""), treatmentDays: number(row.treatment_period_days), prescribedBy: String(row.prescribed_by ?? ""),
    administeredBy: String(row.administered_by ?? ""),
    cycleNumber: filters.cycleNumber ?? null,
  }));
}
