import { db } from "@/lib/Supabase/supabaseClient";

export const HATCHERY_WIZARD_STAGES = [
  "storage",
  "pre_warming",
  "setter",
  "transfer",
  "hatcher",
  "pullout",
] as const;

export type HatcheryWizardStage = (typeof HATCHERY_WIZARD_STAGES)[number];

export type HatcheryWizardClassification = {
  id: number;
  classificationRefNo: string;
  breederRefNo: string;
  farmId: number | null;
  farmCode: string;
  farmName: string;
  classificationDate: string | null;
  totalHatchingEggs: number;
  totalClassified: number;
  isVoided: boolean;
  createdAt: string | null;
};

export type HatcheryWizardStageRecord = {
  id: number;
  stage: HatcheryWizardStage;
  classificationRefNo: string;
  createdAt: string | null;
  updatedAt: string | null;
  isVoided: boolean;
  dateValue: string | null;
  quantity: number | null;
  machine: string | null;
  raw: Record<string, unknown>;
};

export type HatcheryWizardData = {
  classifications: HatcheryWizardClassification[];
  records: Record<HatcheryWizardStage, HatcheryWizardStageRecord[]>;
};

type ClassificationRow = Record<string, unknown> & {
  id: number;
  classi_ref_no?: string | null;
  br_no?: string | null;
  farm_id?: number | null;
  farm_code?: string | null;
  farm_name?: string | null;
  date_classify?: string | null;
  good_egg?: number | null;
  ttl_count?: number | null;
  is_active?: boolean | null;
  void?: number | boolean | null;
  created_at?: string | null;
};

type StageConfig = {
  table: string;
  refColumn: string;
  dateColumns: string[];
  quantityColumn?: string;
  machineColumn?: string;
  usesIsActive?: boolean;
};

const STAGE_CONFIG: Record<HatcheryWizardStage, StageConfig> = {
  storage: {
    table: "egg_storage_mngt",
    refColumn: "classi_ref_no",
    dateColumns: ["shell_start", "created_at"],
  },
  pre_warming: {
    table: "egg_pre_warming",
    refColumn: "egg_ref_no",
    dateColumns: ["egg_temp_time_start", "created_at"],
    usesIsActive: true,
  },
  setter: {
    table: "setter_incubation_process",
    refColumn: "ref_no",
    dateColumns: ["setting_date", "created_at"],
    quantityColumn: "qty_set_egg",
    machineColumn: "machine_id",
  },
  transfer: {
    table: "egg_transfer_process",
    refColumn: "ref_no",
    dateColumns: ["trans_date_start", "created_at"],
    quantityColumn: "total_egg_transfer",
  },
  hatcher: {
    table: "egg_hatchery_process",
    refColumn: "egg_ref",
    dateColumns: ["hatch_time_start", "daterec", "created_at"],
    quantityColumn: "total_egg",
    machineColumn: "machine_no",
  },
  pullout: {
    table: "chick_pullout_process",
    refColumn: "egg_ref_no",
    dateColumns: ["hatch_date", "created_at"],
    quantityColumn: "chicks_hatched",
    machineColumn: "machine_no",
  },
};

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isVoidedRow(row: Record<string, unknown>, usesIsActive = false) {
  if (usesIsActive || typeof row.is_active === "boolean") {
    return row.is_active === false;
  }

  if (row.void === null || row.void === undefined) return false;
  if (typeof row.void === "boolean") return row.void === false;
  return Number(row.void) === 0;
}

function firstValue(row: Record<string, unknown>, columns: string[]) {
  for (const column of columns) {
    const value = textValue(row[column]);
    if (value) return value;
  }
  return null;
}

function parseReferenceValues(value: unknown) {
  return textValue(value)
    .split(",")
    .map((ref) => ref.trim())
    .filter(Boolean);
}

async function listStageRecords(
  stage: HatcheryWizardStage,
  refs: string[],
): Promise<HatcheryWizardStageRecord[]> {
  if (!refs.length) return [];

  const config = STAGE_CONFIG[stage];
  const { data, error } = await db
    .from(config.table)
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const allowedRefs = new Set(refs);
  return ((data ?? []) as Array<Record<string, unknown>>).flatMap((row) =>
    parseReferenceValues(row[config.refColumn])
      .filter((ref) => allowedRefs.has(ref))
      .map((ref) => ({
        id: numberValue(row.id),
        stage,
        classificationRefNo: ref,
        createdAt: textValue(row.created_at) || null,
        updatedAt: textValue(row.updated_at) || null,
        isVoided: isVoidedRow(row, config.usesIsActive),
        dateValue: firstValue(row, config.dateColumns),
        quantity: config.quantityColumn
          ? nullableNumber(row[config.quantityColumn])
          : null,
        machine: config.machineColumn
          ? textValue(row[config.machineColumn]) || null
          : null,
        raw: row,
      })),
  );
}

export async function getHatcheryProcessWizardData(params?: {
  farmIds?: number[];
}): Promise<HatcheryWizardData> {
  let classificationQuery = db
    .from("hatch_classification")
    .select("*")
    .not("classi_ref_no", "is", null)
    .order("created_at", { ascending: false });

  if (params?.farmIds?.length) {
    classificationQuery = classificationQuery.in("farm_id", params.farmIds);
  }

  const { data, error } = await classificationQuery;
  if (error) throw error;

  const classifications = ((data ?? []) as ClassificationRow[])
    .map((row) => ({
      id: numberValue(row.id),
      classificationRefNo: textValue(row.classi_ref_no),
      breederRefNo: textValue(row.br_no),
      farmId: nullableNumber(row.farm_id),
      farmCode: textValue(row.farm_code),
      farmName: textValue(row.farm_name),
      classificationDate: textValue(row.date_classify) || null,
      totalHatchingEggs: numberValue(row.good_egg),
      totalClassified: numberValue(row.ttl_count),
      isVoided: isVoidedRow(row),
      createdAt: textValue(row.created_at) || null,
    }))
    .filter((row) => row.classificationRefNo);

  const refs = Array.from(
    new Set(classifications.map((row) => row.classificationRefNo)),
  );
  const stageEntries = await Promise.all(
    HATCHERY_WIZARD_STAGES.map(async (stage) => [
      stage,
      await listStageRecords(stage, refs),
    ] as const),
  );

  return {
    classifications,
    records: Object.fromEntries(stageEntries) as Record<
      HatcheryWizardStage,
      HatcheryWizardStageRecord[]
    >,
  };
}

export async function getHatcheryWizardClassificationHeader(
  classificationRefNo: string,
) {
  const ref = classificationRefNo.trim();
  if (!ref) return null;

  const { data, error } = await db
    .from("hatch_classification")
    .select("classi_ref_no,br_no,farm_id,farm_code,farm_name")
    .eq("classi_ref_no", ref)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    classificationRefNo: textValue(data.classi_ref_no),
    breederRefNo: textValue(data.br_no),
    farmId: nullableNumber(data.farm_id),
    farmCode: textValue(data.farm_code),
    farmName: textValue(data.farm_name),
  };
}
