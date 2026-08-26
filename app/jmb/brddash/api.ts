import { db } from "@/lib/Supabase/supabaseClient";
import { format, parseISO, startOfMonth, startOfWeek } from "date-fns";

const PLACEMENT_TABLE = "tbl_placement";
const PERFORMANCE_TABLE = "tbl_breeder_daily_performance";
const PAGE_SIZE = 1000;

type PlacementRow = {
  id: number;
  farm_id: number;
  farm_name: string | null;
  building_id: number;
  building_no: string | null;
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

export type BreederDashboardFilter = {
  from: string;
  to: string;
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
  alwMale: number;
  alwFemale: number;
  feedMaleKg: number;
  feedFemaleKg: number;
  averageFeedGrams: number;
};

export type BreederDashboardSummary = {
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
  alwMale: number;
  alwFemale: number;
  feedKg: number;
  averageFeedGrams: number;
};

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
) {
  const rows: PerformanceRow[] = [];

  for (let chunkStart = 0; chunkStart < placementIds.length; chunkStart += 300) {
    const ids = placementIds.slice(chunkStart, chunkStart + 300);
    for (let page = 0; ; page += 1) {
      const from = page * PAGE_SIZE;
      const { data, error } = await db
        .from(PERFORMANCE_TABLE)
        .select(
          "id, placement_id, daterec, inv_male, inv_female, mc_male, mc_female, avg_body_weight_male, avg_body_weight_female, feed_consumption_male, feed_consumption_female",
        )
        .in("placement_id", ids)
        .eq("isactive", true)
        .gte("daterec", filter.from)
        .lte("daterec", filter.to)
        .order("daterec", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

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
  const { data: placementData, error: placementError } = await db
    .from(PLACEMENT_TABLE)
    .select("id")
    .lte("placement_date", filter.to);

  if (placementError) throw new Error(errorMessage(placementError));
  const placementIds = (placementData ?? []).map((row) => numeric(row.id));
  if (!placementIds.length) return [];

  const performance = await performanceForPlacements(placementIds, filter);
  type TrendAccumulator = {
    period: string;
    mortalityMale: number;
    mortalityFemale: number;
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
      feedMaleKg: 0,
      feedFemaleKg: 0,
      birdDays: 0,
      latestByPlacement: new Map<number, PerformanceRow>(),
    };
    current.mortalityMale += numeric(record.mc_male);
    current.mortalityFemale += numeric(record.mc_female);
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
  const { data: placementData, error: placementError } = await db
    .from(PLACEMENT_TABLE)
    .select("id, farm_id, farm_name, building_id, building_no")
    .lte("placement_date", filter.to);

  if (placementError) throw new Error(errorMessage(placementError));
  const placements = (placementData ?? []) as PlacementRow[];
  if (!placements.length) {
    return {
      buildings: [],
      totals: {
        populationMale: 0,
        populationFemale: 0,
        mortalityMale: 0,
        mortalityFemale: 0,
        alwMale: 0,
        alwFemale: 0,
        feedMaleKg: 0,
        feedFemaleKg: 0,
        averageFeedGrams: 0,
      },
    };
  }

  const placementById = new Map(placements.map((row) => [Number(row.id), row]));
  const performance = await performanceForPlacements([...placementById.keys()], filter);
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
    const row = getBuilding(placement);
    row.mortalityMale += numeric(record.mc_male);
    row.mortalityFemale += numeric(record.mc_female);
    row.feedMaleKg += numeric(record.feed_consumption_male);
    row.feedFemaleKg += numeric(record.feed_consumption_female);
    row.birdDays += numeric(record.inv_male) + numeric(record.inv_female);
    latestByPlacement.set(numeric(record.placement_id), record);
  });

  latestByPlacement.forEach((record, placementId) => {
    const placement = placementById.get(placementId);
    if (!placement) return;
    const row = getBuilding(placement);
    const male = numeric(record.inv_male);
    const female = numeric(record.inv_female);
    row.populationMale += male;
    row.populationFemale += female;
    row.alwMale += numeric(record.avg_body_weight_male) * male;
    row.alwFemale += numeric(record.avg_body_weight_female) * female;
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

  return { buildings: result, totals };
}
