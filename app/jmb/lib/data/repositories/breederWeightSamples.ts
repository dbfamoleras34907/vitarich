import { db } from "@/lib/Supabase/supabaseClient";
import { calculateWeightSamples } from "../../breederWeightSamples";

export type BreederWeightSampleRecord = {
  id: number;
  placement_id: number;
  farm_id: number;
  sample_date: string;
  male_weights: number[];
  female_weights: number[];
  male_mean: number;
  female_mean: number;
  male_uniformity: number;
  female_uniformity: number;
  revision: number;
  updated_at: string;
};

type SampleFilter = { placementIds: number[]; from?: string; to?: string };
const storageMessage = "Weight sample storage is not installed. Apply app/jmb/placement/card/breeder_weight_samples.sql in Supabase.";
function missingStorage(error: { code?: string }) {
  return ["42P01", "PGRST205", "PGRST202"].includes(error.code ?? "");
}

export async function listBreederWeightSamples(filter: SampleFilter) {
  const records: BreederWeightSampleRecord[] = [];
  for (let offset = 0; offset < filter.placementIds.length; offset += 300) {
    for (let page = 0; ; page++) {
      let query = db.from("breeder_weight_samples").select("*")
        .in("placement_id", filter.placementIds.slice(offset, offset + 300))
        .order("sample_date").order("id").range(page * 1000, page * 1000 + 999);
      if (filter.from) query = query.gte("sample_date", filter.from);
      if (filter.to) query = query.lte("sample_date", filter.to);
      const { data, error } = await query;
      if (error && missingStorage(error)) return { available: false, records: [] as BreederWeightSampleRecord[] };
      if (error) throw new Error(error.message);
      records.push(...(data ?? []) as BreederWeightSampleRecord[]);
      if ((data?.length ?? 0) < 1000) break;
    }
  }
  records.sort((a, b) => a.sample_date.localeCompare(b.sample_date) || a.id - b.id);
  return { available: true, records };
}

export async function saveBreederWeightSamples(input: {
  placementId: number;
  date: string;
  male: number[];
  female: number[];
  expectedRevision: number;
  requestKey: string;
}): Promise<BreederWeightSampleRecord> {
  if (!calculateWeightSamples(input.male) || !calculateWeightSamples(input.female)) {
    throw new Error("Enter exactly 50 positive weights in grams for each sex.");
  }
  const { data, error } = await db.rpc("save_breeder_weight_samples", {
    p_placement_id: input.placementId, p_sample_date: input.date,
    p_male_weights: input.male, p_female_weights: input.female,
    p_expected_revision: input.expectedRevision, p_request_key: input.requestKey,
  });
  if (error) throw new Error(missingStorage(error) ? storageMessage : error.message);
  const record = Array.isArray(data) ? data[0] : data;
  if (!record?.id) throw new Error("Weight samples were not returned by the save operation.");
  return record as BreederWeightSampleRecord;
}
