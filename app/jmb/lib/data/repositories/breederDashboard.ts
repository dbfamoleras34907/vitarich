import { listBreederCycles } from "@/app/jmb/placement/new/api";
import { db } from "@/lib/Supabase/supabaseClient";
import { format, parseISO, startOfMonth, startOfWeek } from "date-fns";

const PLACEMENT_TABLE = "tbl_placement";
const PERFORMANCE_TABLE = "tbl_breeder_daily_performance";
const PAGE_SIZE = 1000;

type PlacementRow = {
  id: number;
  cycle_id: number | null;
  placement_date: string;
  farm_id: number;
  farm_name: string | null;
  building_id: number;
  building_no: string | null;
  pen_no: string | null;
  f_endingbalance: number | null;
  m_endingbalance: number | null;
};

type PerformanceRow = {
  id: number;
  placement_id: number;
  daterec: string;
  m_uniformity: number | null;
  f_uniformity: number | null;
  m_body_weight: number | null;
  f_body_weight: number | null;
  inv_male: number | null;
  inv_female: number | null;
  mc_male: number | null;
  mc_female: number | null;
  cull_male: number | null;
  cull_female: number | null;
  trans_in_male: number | null;
  trans_in_female: number | null;
  trans_out_male: number | null;
  trans_out_female: number | null;
  kitchen_male: number | null;
  kitchen_female: number | null;
  condem_male: number | null;
  condem_female: number | null;

  avg_body_weight_male: number | null;
  avg_body_weight_female: number | null;
  feed_consumption_male: number | null;
  feed_consumption_female: number | null;
};

export type BreederDashboardFilter = {
  from: string;
  to: string;
  farmId?: number;
};

export type BreederDashboardFarm = {
  id: number;
  name: string;
};

export type BuildingDashboardRow = {
  key: string;
  farmId: number;
  farmName: string;
  buildingId: number;
  buildingName: string;
  populationMale: number;
  populationFemale: number;
  mortalityMale: number;
  mortalityFemale: number;
  growingMortality: number;
  layingMortality: number;
  otherAgeMortality: number;
  soldCulls: number;
  transferOut: number;
  kitchen: number;
  condemn: number;
  alwMale: number;
  alwFemale: number;
  feedMaleKg: number;
  feedFemaleKg: number;
  averageFeedGrams: number;
};

export type WeeklyBodyWeightReading = {
  date: string;
  ageDays: number | null;
  value: number;
};

export type BreederWeeklyBodyWeight = {
  placementId: number;
  farmName: string;
  buildingName: string;
  penName: string;
  male: WeeklyBodyWeightReading | null;
  female: WeeklyBodyWeightReading | null;
};

export type BreederDashboardSummary = {
  activePlacements: { id: number; placementDate: string; farmName: string; buildingName: string; penName: string }[];
  latestUniformity: { male: { value: number; date: string } | null; female: { value: number; date: string } | null };
  latestFeed: { date: string; ageDays: number | null; gramsPerBird: number | null } | null;
  latestFlockAge: {
    placementId: number;
    placementDate: string;
    farmName: string;
    buildingName: string;
    penName: string;
    ageDays: number;
  } | null;
  weeklyBodyWeights: BreederWeeklyBodyWeight[];
  buildings: BuildingDashboardRow[];
  totals: Omit<BuildingDashboardRow, "key" | "farmId" | "farmName" | "buildingId" | "buildingName">;
};

export type BreederTrendGroup = "daily" | "weekly" | "monthly";

export type BreederTrendRow = {
  period: string;
  populationMale: number;
  populationFemale: number;
  mortalityMale: number;
  mortalityFemale: number;
  growingMortality: number;
  layingMortality: number;
  otherAgeMortality: number;
  alwMale: number;
  alwFemale: number;
  feedKg: number;
  averageFeedGrams: number;
};

// Population Record treats placement day as age 0.1 (day one).
// Weeks.Day is base seven: 25.0 = 175 days, 25.1 = 176, 65.0 = 455.
export function breederAgeDays(placementDate: string | undefined, recordDate: string): number | null {
  const calendarDay = (value: string | undefined) => {
    const date = value?.slice(0, 10) ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Number.NaN;
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
      ? timestamp : Number.NaN;
  };
  const days = (calendarDay(recordDate) - calendarDay(placementDate)) / 86_400_000 + 1;
  return Number.isInteger(days) && days >= 1 ? days : null;
}

export function mortalityAgeBucket(placementDate: string | undefined, recordDate: string) {
  const days = breederAgeDays(placementDate, recordDate);
  if (days == null) return "otherAgeMortality";
  if (days >= 1 && days <= 175) return "growingMortality";
  if (days >= 176 && days <= 455) return "layingMortality";
  return "otherAgeMortality";
}

function numeric(value: unknown) {
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

async function performanceForPlacements(
  placementIds: number[],
  filter: BreederDashboardFilter,
  includeEarlier = false,
) {
  const rows: PerformanceRow[] = [];

  for (let chunkStart = 0; chunkStart < placementIds.length; chunkStart += 300) {
    const ids = placementIds.slice(chunkStart, chunkStart + 300);
    for (let page = 0; ; page += 1) {
      const from = page * PAGE_SIZE;
      let query = db
        .from(PERFORMANCE_TABLE)
        .select(
          "id, placement_id, daterec, m_uniformity, f_uniformity, m_body_weight, f_body_weight, inv_male, inv_female, mc_male, mc_female, cull_male, cull_female, trans_in_male, trans_in_female, trans_out_male, trans_out_female, kitchen_male, kitchen_female, condem_male, condem_female, avg_body_weight_male, avg_body_weight_female, feed_consumption_male, feed_consumption_female",
        )
        .in("placement_id", ids)
        .eq("isactive", true)
        .lte("daterec", filter.to)
        .order("daterec", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (!includeEarlier) query = query.gte("daterec", filter.from);
      const { data, error } = await query;
      if (error) throw new Error(errorMessage(error));
      const pageRows = (data ?? []) as PerformanceRow[];
      rows.push(...pageRows);
      if (pageRows.length < PAGE_SIZE) break;
    }
  }

  return rows;
}

function periodKey(date: string, groupBy: BreederTrendGroup) {
  const parsed = parseISO(date);
  if (groupBy === "weekly") {
    return format(startOfWeek(parsed, { weekStartsOn: 1 }), "yyyy-MM-dd");
  }
  if (groupBy === "monthly") {
    return format(startOfMonth(parsed), "yyyy-MM-dd");
  }
  return date;
}

export async function getBreederTrend(
  filter: BreederDashboardFilter,
  groupBy: BreederTrendGroup,
): Promise<BreederTrendRow[]> {
  let placementQuery = db
    .from(PLACEMENT_TABLE)
    .select("id, placement_date")
    .lte("placement_date", filter.to);

  if (filter.farmId) placementQuery = placementQuery.eq("farm_id", filter.farmId);

  const { data: placementData, error: placementError } = await placementQuery;

  if (placementError) throw new Error(errorMessage(placementError));
  const placementDates = new Map((placementData ?? []).map(row => [numeric(row.id), String(row.placement_date ?? "")]));
  const placementIds = (placementData ?? []).map((row) => numeric(row.id));
  if (!placementIds.length) return [];

  const performance = await performanceForPlacements(placementIds, filter);
  type TrendAccumulator = {
    period: string;
    mortalityMale: number;
    mortalityFemale: number;
  growingMortality: number;
  layingMortality: number;
  otherAgeMortality: number;
    feedMaleKg: number;
    feedFemaleKg: number;
    birdDays: number;
    latestByPlacement: Map<number, PerformanceRow>;
  };
  const periods = new Map<string, TrendAccumulator>();

  performance.forEach((record) => {
    const period = periodKey(record.daterec, groupBy);
    const current = periods.get(period) ?? {
      period,
      mortalityMale: 0,
      mortalityFemale: 0,
      growingMortality: 0,
      layingMortality: 0,
      otherAgeMortality: 0,
      feedMaleKg: 0,
      feedFemaleKg: 0,
      birdDays: 0,
      latestByPlacement: new Map<number, PerformanceRow>(),
    };
    current.mortalityMale += numeric(record.mc_male);
    current.mortalityFemale += numeric(record.mc_female);
    current[mortalityAgeBucket(placementDates.get(numeric(record.placement_id)), record.daterec)] += numeric(record.mc_male) + numeric(record.mc_female);
    current.feedMaleKg += numeric(record.feed_consumption_male);
    current.feedFemaleKg += numeric(record.feed_consumption_female);
    current.birdDays += numeric(record.inv_male) + numeric(record.inv_female);
    current.latestByPlacement.set(numeric(record.placement_id), record);
    periods.set(period, current);
  });

  return [...periods.values()]
    .map((period): BreederTrendRow => {
      let populationMale = 0;
      let populationFemale = 0;
      let weightedAlwMale = 0;
      let weightedAlwFemale = 0;

      period.latestByPlacement.forEach((record) => {
        const male = numeric(record.inv_male);
        const female = numeric(record.inv_female);
        populationMale += male;
        populationFemale += female;
        weightedAlwMale += numeric(record.avg_body_weight_male) * male;
        weightedAlwFemale += numeric(record.avg_body_weight_female) * female;
      });

      const feedKg = period.feedMaleKg + period.feedFemaleKg;
      return {
        period: period.period,
        populationMale,
        populationFemale,
        mortalityMale: period.mortalityMale,
        mortalityFemale: period.mortalityFemale,
        growingMortality: period.growingMortality,
        layingMortality: period.layingMortality,
        otherAgeMortality: period.otherAgeMortality,
        alwMale: populationMale ? weightedAlwMale / populationMale : 0,
        alwFemale: populationFemale ? weightedAlwFemale / populationFemale : 0,
        feedKg,
        averageFeedGrams: period.birdDays ? (feedKg * 1000) / period.birdDays : 0,
      };
    })
    .sort((left, right) => left.period.localeCompare(right.period));
}

export async function getBreederDashboard(
  filter: BreederDashboardFilter,
): Promise<BreederDashboardSummary> {
  const placements: PlacementRow[] = [];
  for (let page = 0; ; page += 1) {
    let query = db.from(PLACEMENT_TABLE)
      .select("id, cycle_id, placement_date, farm_id, farm_name, building_id, building_no, pen_no, f_endingbalance, m_endingbalance")
      .lte("placement_date", filter.to)
      .order("id", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (filter.farmId) query = query.eq("farm_id", filter.farmId);
    const { data, error } = await query;
    if (error) throw new Error(errorMessage(error));
    const rows = (data ?? []) as PlacementRow[];
    placements.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  if (!placements.length) {
    return {
      activePlacements: [],
      latestUniformity: { male: null, female: null },
      latestFlockAge: null,
      latestFeed: null,
      weeklyBodyWeights: [],
      buildings: [],
      totals: {
        populationMale: 0,
        populationFemale: 0,
        mortalityMale: 0,
        mortalityFemale: 0,
      growingMortality: 0,
      layingMortality: 0,
      otherAgeMortality: 0,
        soldCulls: 0,
        transferOut: 0,
        kitchen: 0,
        condemn: 0,
        alwMale: 0,
        alwFemale: 0,
        feedMaleKg: 0,
        feedFemaleKg: 0,
        averageFeedGrams: 0,
      },
    };
  }

  const placementById = new Map(placements.map((row) => [Number(row.id), row]));
  const performance = await performanceForPlacements([...placementById.keys()], filter, true);
  const latestByPlacement = new Map<number, PerformanceRow>();

  type Accumulator = BuildingDashboardRow & {
    maleWeightBasis: number;
    femaleWeightBasis: number;
    birdDays: number;
  };
  const buildings = new Map<string, Accumulator>();

  const getBuilding = (placement: PlacementRow) => {
    const key = `${placement.farm_id}:${placement.building_id}`;
    let row = buildings.get(key);
    if (!row) {
      row = {
        key,
        farmId: numeric(placement.farm_id),
        farmName: placement.farm_name || "Unspecified farm",
        buildingId: numeric(placement.building_id),
        buildingName: placement.building_no || "Unspecified building",
        populationMale: 0,
        populationFemale: 0,
        mortalityMale: 0,
        mortalityFemale: 0,
      growingMortality: 0,
      layingMortality: 0,
      otherAgeMortality: 0,
        soldCulls: 0,
        transferOut: 0,
        kitchen: 0,
        condemn: 0,
        alwMale: 0,
        alwFemale: 0,
        feedMaleKg: 0,
        feedFemaleKg: 0,
        averageFeedGrams: 0,
        maleWeightBasis: 0,
        femaleWeightBasis: 0,
        birdDays: 0,
      };
      buildings.set(key, row);
    }
    return row;
  };

  performance.forEach((record) => {
    const placement = placementById.get(numeric(record.placement_id));
    if (!placement) return;
    latestByPlacement.set(numeric(record.placement_id), record);
    if (record.daterec.slice(0, 10) < filter.from) return;
    const row = getBuilding(placement);
    row.soldCulls += numeric(record.cull_male) + numeric(record.cull_female);
    row.transferOut += numeric(record.trans_out_male) + numeric(record.trans_out_female);
    row.kitchen += numeric(record.kitchen_male) + numeric(record.kitchen_female);
    row.condemn += numeric(record.condem_male) + numeric(record.condem_female);
    row.mortalityMale += numeric(record.mc_male);
    row.mortalityFemale += numeric(record.mc_female);
    row[mortalityAgeBucket(placement.placement_date, record.daterec)] += numeric(record.mc_male) + numeric(record.mc_female);
    row.feedMaleKg += numeric(record.feed_consumption_male);
    row.feedFemaleKg += numeric(record.feed_consumption_female);
    row.birdDays += numeric(record.inv_male) + numeric(record.inv_female);
  });

  placements.forEach((placement) => {
    const record = latestByPlacement.get(numeric(placement.id));
    const row = getBuilding(placement);
    const closing = (sex: "male" | "female") => record
      ? Math.max(0, numeric(record[`inv_${sex}`]) + numeric(record[`trans_in_${sex}`])
          - numeric(record[`mc_${sex}`]) - numeric(record[`cull_${sex}`])
          - numeric(record[`trans_out_${sex}`]) - numeric(record[`kitchen_${sex}`])
          - numeric(record[`condem_${sex}`]))
      : numeric(sex === "male" ? placement.m_endingbalance : placement.f_endingbalance);
    const male = closing("male");
    const female = closing("female");
    row.populationMale += male;
    row.populationFemale += female;
    row.alwMale += numeric(record?.avg_body_weight_male) * male;
    row.alwFemale += numeric(record?.avg_body_weight_female) * female;
    row.maleWeightBasis += male;
    row.femaleWeightBasis += female;
  });

  const totalBirdDays = [...buildings.values()].reduce(
    (sum, row) => sum + row.birdDays,
    0,
  );
  const result = [...buildings.values()]
    .map(({ maleWeightBasis, femaleWeightBasis, birdDays, ...row }) => ({
      ...row,
      alwMale: maleWeightBasis ? row.alwMale / maleWeightBasis : 0,
      alwFemale: femaleWeightBasis ? row.alwFemale / femaleWeightBasis : 0,
      averageFeedGrams: birdDays
        ? ((row.feedMaleKg + row.feedFemaleKg) * 1000) / birdDays
        : 0,
    }))
    .sort(
      (left, right) =>
        left.farmName.localeCompare(right.farmName) ||
        left.buildingName.localeCompare(right.buildingName, undefined, { numeric: true }),
    );

  const totals = result.reduce(
    (total, row) => {
      total.populationMale += row.populationMale;
      total.populationFemale += row.populationFemale;
      total.mortalityMale += row.mortalityMale;
      total.mortalityFemale += row.mortalityFemale;
      total.growingMortality += row.growingMortality;
      total.layingMortality += row.layingMortality;
      total.otherAgeMortality += row.otherAgeMortality;
      total.soldCulls += row.soldCulls;
      total.transferOut += row.transferOut;
      total.kitchen += row.kitchen;
      total.condemn += row.condemn;
      total.feedMaleKg += row.feedMaleKg;
      total.feedFemaleKg += row.feedFemaleKg;
      total.alwMale += row.alwMale * row.populationMale;
      total.alwFemale += row.alwFemale * row.populationFemale;
      return total;
    },
    {
      populationMale: 0,
      populationFemale: 0,
      mortalityMale: 0,
      mortalityFemale: 0,
      growingMortality: 0,
      layingMortality: 0,
      otherAgeMortality: 0,
        soldCulls: 0,
        transferOut: 0,
        kitchen: 0,
        condemn: 0,
      alwMale: 0,
      alwFemale: 0,
      feedMaleKg: 0,
      feedFemaleKg: 0,
      averageFeedGrams: 0,
    },
  );

  const totalMale = totals.populationMale;
  const totalFemale = totals.populationFemale;
  totals.alwMale = totalMale ? totals.alwMale / totalMale : 0;
  totals.alwFemale = totalFemale ? totals.alwFemale / totalFemale : 0;
  totals.averageFeedGrams = totalBirdDays
    ? ((totals.feedMaleKg + totals.feedFemaleKg) * 1000) / totalBirdDays
    : 0;

  const weeklyBodyWeights = placements.map((placement): BreederWeeklyBodyWeight => ({
    placementId: placement.id,
    farmName: placement.farm_name || "Unspecified farm",
    buildingName: placement.building_no || "Unspecified building",
    penName: placement.pen_no || "Unspecified pen",
    male: null,
    female: null,
  }));
  const weightsByPlacement = new Map(weeklyBodyWeights.map(row => [Number(row.placementId), row]));
  // Records are ordered by date and ID. A blank later entry must not erase a weighing.
  for (const record of performance) {
    const row = weightsByPlacement.get(numeric(record.placement_id));
    const placement = placementById.get(numeric(record.placement_id));
    if (!row || !placement) continue;
    const ageDays = breederAgeDays(placement.placement_date, record.daterec);
    for (const [sex, value] of [["male", record.m_body_weight], ["female", record.f_body_weight]] as const) {
      if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) continue;
      row[sex] = { date: record.daterec.slice(0, 10), ageDays, value: Number(value) };
    }
  }
  weeklyBodyWeights.sort((a, b) => a.farmName.localeCompare(b.farmName)
    || a.buildingName.localeCompare(b.buildingName, undefined, { numeric: true })
    || a.penName.localeCompare(b.penName, undefined, { numeric: true })
    || a.placementId - b.placementId);
  const latestPlacement = placements.filter(row => breederAgeDays(row.placement_date, filter.to) != null)
    .sort((a, b) => b.placement_date.localeCompare(a.placement_date) || b.id - a.id)[0];
  const latestFlockAge = latestPlacement ? {
    placementId: latestPlacement.id,
    placementDate: latestPlacement.placement_date,
    farmName: latestPlacement.farm_name || "Unspecified farm",
    buildingName: latestPlacement.building_no || "Unspecified building",
    penName: latestPlacement.pen_no || "Unspecified pen",
    ageDays: breederAgeDays(latestPlacement.placement_date, filter.to)!,
  } : null;
  const latestFeedRecord = latestPlacement ? latestByPlacement.get(Number(latestPlacement.id)) : undefined;
  const latestFeedPopulation = latestFeedRecord
    ? numeric(latestFeedRecord.inv_male) + numeric(latestFeedRecord.inv_female) : 0;
  const latestFeed = latestFeedRecord && latestPlacement ? {
    date: latestFeedRecord.daterec.slice(0, 10),
    ageDays: breederAgeDays(latestPlacement.placement_date, latestFeedRecord.daterec),
    gramsPerBird: latestFeedPopulation > 0
      ? (numeric(latestFeedRecord.feed_consumption_male) + numeric(latestFeedRecord.feed_consumption_female)) * 1000 / latestFeedPopulation
      : null,
  } : null;
  const latestUniformity: BreederDashboardSummary["latestUniformity"] = { male: null, female: null };
  for (const record of performance) {
    if (Number(record.placement_id) !== latestPlacement?.id) continue;
    for (const [sex, value] of [["male", record.m_uniformity], ["female", record.f_uniformity]] as const) {
      if (value != null && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100) {
        latestUniformity[sex] = { value: Number(value), date: record.daterec.slice(0, 10) };
      }
    }
  }
  const activeCycleIds = new Set((await listBreederCycles())
    .filter(cycle => cycle.status.toLowerCase() === "active").map(cycle => Number(cycle.id)));
  const activePlacements = placements.filter(row => row.cycle_id != null && activeCycleIds.has(Number(row.cycle_id)))
    .sort((a, b) => b.placement_date.localeCompare(a.placement_date) || b.id - a.id)
    .map(row => ({ id: row.id, placementDate: row.placement_date,
      farmName: row.farm_name || "Unspecified farm", buildingName: row.building_no || "Unspecified building",
      penName: row.pen_no || "Unspecified pen" }));
  return { buildings: result, totals, weeklyBodyWeights, latestFlockAge, latestFeed, latestUniformity, activePlacements };
}

export async function listBreederDashboardFarms(): Promise<BreederDashboardFarm[]> {
  const farms = new Map<number, BreederDashboardFarm>();

  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await db
      .from(PLACEMENT_TABLE)
      .select("farm_id, farm_name")
      .order("farm_name", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(errorMessage(error));
    const rows = (data ?? []) as Pick<PlacementRow, "farm_id" | "farm_name">[];
    rows.forEach((row) => {
      const id = numeric(row.farm_id);
      if (id && !farms.has(id)) {
        farms.set(id, { id, name: row.farm_name || `Farm ${id}` });
      }
    });
    if (rows.length < PAGE_SIZE) break;
  }

  return [...farms.values()].sort((left, right) => left.name.localeCompare(right.name));
}
