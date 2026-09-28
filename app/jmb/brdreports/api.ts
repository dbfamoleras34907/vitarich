import { db } from "@/lib/Supabase/supabaseClient";
import { listBreederEggLayings } from "@/app/jmb/lib/data/repositories/breederEggLaying";

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
  cull_male: number | null;
  cull_female: number | null;
  kitchen_male: number | null;
  kitchen_female: number | null;
  condem_male: number | null;
  condem_female: number | null;
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
  cullMale: number;
  cullFemale: number;
  kitchenMale: number;
  kitchenFemale: number;
  condemnedMale: number;
  condemnedFemale: number;
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
  scheduledDate: string | null;
  dateVarianceDays: number | null;
  farmName: string;
  scope: string;
  buildingName: string;
  targetNames: string;
  vaccine: string;
  diseaseTarget: string;
  dosage: number;
  route: string;
  birdsBefore: number;
  birdsVaccinated: number;
  birdsMissed: number;
  batchNumber: string;
  expiryDate: string;
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

export type BreederPerformanceReportRow = {
  ageWeek: number;
  malePopulation: number;
  femalePopulation: number;
  mortality: number;
  otherDepletion: number;
  totalDepletion: number;
  maleBodyWeight: number | null;
  femaleBodyWeight: number | null;
  averageGramsPerBird: number | null;
  tep: number;
  hatchingEgg: number;
  heRecovery: number | null;
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
      .select("id, placement_id, daterec, inv_male, inv_female, mc_male, mc_female, cull_male, cull_female, kitchen_male, kitchen_female, condem_male, condem_female, avg_body_weight_male, avg_body_weight_female, feed_consumption_male, feed_consumption_female")
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
        cullMale: number(row.cull_male),
        cullFemale: number(row.cull_female),
        kitchenMale: number(row.kitchen_male),
        kitchenFemale: number(row.kitchen_female),
        condemnedMale: number(row.condem_male),
        condemnedFemale: number(row.condem_female),
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

function ageWeek(placementDate: string, recordDate: string) {
  const start = new Date(`${placementDate}T00:00:00`);
  const end = new Date(`${recordDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
  return Math.ceil(days / 7);
}

/**
 * Weekly breeder performance summary. Population and body weight use the last
 * recorded value for each placement/week; depletion and egg production are
 * accumulated across the week.
 */
export async function listBreederPerformanceReport(filters: MortalityReportFilters): Promise<BreederPerformanceReportRow[]> {
  const placements = await reportPlacements(filters);
  if (!placements.length) return [];

  const placementIds = placements.map((placement) => Number(placement.id));
  const placementById = new Map(placements.map((placement) => [Number(placement.id), placement]));
  const [dailyRows, eggRows] = await Promise.all([
    listMortalityReport(filters),
    listBreederEggLayings({ placementIds, from: filters.dateFrom, to: filters.dateTo, ascending: true }),
  ]);

  type PlacementWeek = {
    ageWeek: number;
    latestPopulationDate: string;
    malePopulation: number;
    femalePopulation: number;
    maleWeightDate: string;
    femaleWeightDate: string;
    maleBodyWeight: number | null;
    femaleBodyWeight: number | null;
    mortality: number;
    otherDepletion: number;
    tep: number;
    hatchingEgg: number;
  };
  const placementWeeks = new Map<string, PlacementWeek>();

  const ensureWeek = (placementId: number, recordDate: string) => {
    const placement = placementById.get(placementId);
    if (!placement) return null;
    const week = ageWeek(placement.placement_date, recordDate);
    if (week == null) return null;
    const key = `${placementId}:${week}`;
    const current = placementWeeks.get(key) ?? {
      ageWeek: week, latestPopulationDate: "", malePopulation: 0, femalePopulation: 0,
      maleWeightDate: "", femaleWeightDate: "", maleBodyWeight: null, femaleBodyWeight: null,
      mortality: 0, otherDepletion: 0, tep: 0, hatchingEgg: 0,
    };
    placementWeeks.set(key, current);
    return current;
  };

  dailyRows.forEach((row) => {
    const current = ensureWeek(row.placementId, row.recordDate);
    if (!current) return;
    if (row.recordDate >= current.latestPopulationDate) {
      current.latestPopulationDate = row.recordDate;
      current.malePopulation = row.inventoryMale;
      current.femalePopulation = row.inventoryFemale;
    }
    if (row.averageWeightMale > 0 && row.recordDate >= current.maleWeightDate) {
      current.maleWeightDate = row.recordDate;
      current.maleBodyWeight = row.averageWeightMale;
    }
    if (row.averageWeightFemale > 0 && row.recordDate >= current.femaleWeightDate) {
      current.femaleWeightDate = row.recordDate;
      current.femaleBodyWeight = row.averageWeightFemale;
    }
    current.mortality += row.mortalityMale + row.mortalityFemale;
    current.otherDepletion += row.cullMale + row.cullFemale + row.kitchenMale + row.kitchenFemale + row.condemnedMale + row.condemnedFemale;
  });

  eggRows.forEach((row) => {
    const current = ensureWeek(Number(row.placement_id), row.date_laying);
    if (!current) return;
    current.tep += number(row.tep_collection);
    current.hatchingEgg += number(row.hatching_egg);
  });

  type WeeklyAccumulator = Omit<BreederPerformanceReportRow, "maleBodyWeight" | "femaleBodyWeight" | "averageGramsPerBird" | "heRecovery"> & {
    maleWeightTotal: number;
    maleWeightBirds: number;
    femaleWeightTotal: number;
    femaleWeightBirds: number;
  };
  const weekly = new Map<number, WeeklyAccumulator>();
  placementWeeks.forEach((row) => {
    const current = weekly.get(row.ageWeek) ?? {
      ageWeek: row.ageWeek, malePopulation: 0, femalePopulation: 0, mortality: 0, otherDepletion: 0,
      totalDepletion: 0, tep: 0, hatchingEgg: 0, maleWeightTotal: 0, maleWeightBirds: 0,
      femaleWeightTotal: 0, femaleWeightBirds: 0,
    };
    current.malePopulation += row.malePopulation;
    current.femalePopulation += row.femalePopulation;
    current.mortality += row.mortality;
    current.otherDepletion += row.otherDepletion;
    current.totalDepletion = current.mortality + current.otherDepletion;
    current.tep += row.tep;
    current.hatchingEgg += row.hatchingEgg;
    if (row.maleBodyWeight != null && row.malePopulation > 0) {
      current.maleWeightTotal += row.maleBodyWeight * row.malePopulation;
      current.maleWeightBirds += row.malePopulation;
    }
    if (row.femaleBodyWeight != null && row.femalePopulation > 0) {
      current.femaleWeightTotal += row.femaleBodyWeight * row.femalePopulation;
      current.femaleWeightBirds += row.femalePopulation;
    }
    weekly.set(row.ageWeek, current);
  });

  return [...weekly.values()].sort((left, right) => left.ageWeek - right.ageWeek).map((row) => {
    const maleBodyWeight = row.maleWeightBirds > 0 ? row.maleWeightTotal / row.maleWeightBirds : null;
    const femaleBodyWeight = row.femaleWeightBirds > 0 ? row.femaleWeightTotal / row.femaleWeightBirds : null;
    const measuredBirds = row.maleWeightBirds + row.femaleWeightBirds;
    return {
      ageWeek: row.ageWeek,
      malePopulation: row.malePopulation,
      femalePopulation: row.femalePopulation,
      mortality: row.mortality,
      otherDepletion: row.otherDepletion,
      totalDepletion: row.totalDepletion,
      maleBodyWeight,
      femaleBodyWeight,
      averageGramsPerBird: measuredBirds > 0 ? (row.maleWeightTotal + row.femaleWeightTotal) / measuredBirds : null,
      tep: row.tep,
      hatchingEgg: row.hatchingEgg,
      heRecovery: row.tep > 0 ? (row.hatchingEgg / row.tep) * 100 : null,
    };
  });
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
    scheduledDate: row.scheduled_vaccination_date ?? null, dateVarianceDays: row.date_variance_days == null ? null : number(row.date_variance_days),
    farmName: String(row.farm_name ?? ""), scope: String(row.scope ?? ""), buildingName: String(row.building_name ?? ""),
    targetNames: String(row.target_names ?? ""), vaccine: [row.vaccine_brand, row.vaccine_type].filter(Boolean).join(" - "),
    diseaseTarget: String(row.disease_target ?? ""), dosage: number(row.dosage), route: String(row.route ?? ""),
    birdsBefore: number(row.birds_before), birdsVaccinated: number(row.birds_vaccinated), birdsMissed: number(row.birds_missed),
    batchNumber: String(row.batch_number ?? ""), expiryDate: String(row.expiry_date ?? ""),
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
