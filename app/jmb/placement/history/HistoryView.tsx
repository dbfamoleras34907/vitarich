"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Egg, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import {
  listDailyPerformance,
  listFeedTypes,
  type BreederDailyPerformance,
  type FeedType,
} from "../card/api";
import {
  listEggLayingsByPlacements,
  type EggLaying,
} from "../../egglaying/new/api";
import { listPlacementHistory, type Placement } from "../new/api";

type HistoryMode = "growing" | "laying";
type GrowingHistoryRow = Omit<
  BreederDailyPerformance,
  "id" | "created_at" | "created_by" | "updated_at" | "updated_by"
> & { id?: number };

const zeroDailyFields = {
  mc_male: 0,
  mc_female: 0,
  cull_male: 0,
  cull_female: 0,
  trans_in_male: 0,
  trans_in_female: 0,
  trans_out_male: 0,
  trans_out_female: 0,
  kitchen_male: 0,
  kitchen_female: 0,
  condem_male: 0,
  condem_female: 0,
  avg_body_weight_male: 0,
  avg_body_weight_female: 0,
  feed_consumption_male: 0,
  feed_consumption_female: 0,
};

function normalizeDate(value?: string | null) {
  return String(value ?? "").slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${normalizeDate(value)}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const normalized = normalizeDate(value);
  const date = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? normalized
    : date.toLocaleDateString("en-PH", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
}

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function count(value: unknown) {
  return number(value).toLocaleString("en-PH", { maximumFractionDigits: 2 });
}

function ageOn(placementDate?: string | null, recordDate?: string | null) {
  if (!placementDate || !recordDate) return 0;
  const start = Date.parse(`${normalizeDate(placementDate)}T00:00:00Z`);
  const end = Date.parse(`${normalizeDate(recordDate)}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(1, Math.floor((end - start) / 86_400_000) + 1)
    : 0;
}

function placementInventory(
  placement: Placement | undefined,
  sex: "male" | "female",
) {
  if (!placement) return 0;
  return sex === "male"
    ? number(
        placement.m_endingbalance ??
          placement.m_beg -
            placement.m_doa -
            placement.m_reject -
            placement.m_shortcount,
      )
    : number(
        placement.f_endingbalance ??
          placement.f_beg -
            placement.f_doa -
            placement.f_reject -
            placement.f_shortcount,
      );
}

function liveInventory(
  row: GrowingHistoryRow | undefined,
  sex: "male" | "female",
) {
  if (!row) return 0;
  return sex === "male"
    ? number(row.inv_male) +
        number(row.trans_in_male) -
        number(row.mc_male) -
        number(row.cull_male) -
        number(row.trans_out_male) -
        number(row.kitchen_male) -
        number(row.condem_male)
    : number(row.inv_female) +
        number(row.trans_in_female) -
        number(row.mc_female) -
        number(row.cull_female) -
        number(row.trans_out_female) -
        number(row.kitchen_female) -
        number(row.condem_female);
}

function inRange(date: string, fromDate: string, toDate: string) {
  const normalized = normalizeDate(date);
  return (
    (!fromDate || normalized >= fromDate) && (!toDate || normalized <= toDate)
  );
}

function buildGrowingRows(
  placement: Placement,
  savedRows: BreederDailyPerformance[],
) {
  const savedByDate = new Map(
    savedRows.map((row) => [normalizeDate(row.daterec), row]),
  );
  const lastSavedDay = savedRows.reduce(
    (latest, row) =>
      Math.max(
        latest,
        ageOn(placement.placement_date, normalizeDate(row.daterec)),
      ),
    0,
  );
  let maleInventory = placementInventory(placement, "male");
  let femaleInventory = placementInventory(placement, "female");
  return Array.from(
    { length: Math.max(31, lastSavedDay) },
    (_, index): GrowingHistoryRow => {
      const daterec = addDays(placement.placement_date, index);
      const saved = savedByDate.get(daterec);
      const row: GrowingHistoryRow = {
        ...(saved ?? {
          placement_id: placement.id,
          daterec,
          ...zeroDailyFields,
          male_feedtype_id: null,
          female_feedtype_id: null,
          isactive: true,
        }),
        daterec,
        inv_male: maleInventory,
        inv_female: femaleInventory,
      };
      maleInventory = liveInventory(row, "male");
      femaleInventory = liveInventory(row, "female");
      return row;
    },
  );
}

function headerClass(groupEnd = false) {
  return `fc-grid-header fc-grid-header-border sticky z-30 px-2 py-0 text-center text-xs font-semibold ${groupEnd ? "fc-grid-group-divider" : "fc-grid-border-r"}`;
}

export default function HistoryView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: HistoryMode =
    searchParams.get("mode") === "laying" ? "laying" : "growing";
  const farmId = Number(searchParams.get("farmId"));
  const buildingId = Number(searchParams.get("buildingId"));
  const cycleNoText = searchParams.get("cycleNo");
  const cycleNo = cycleNoText == null ? null : Number(cycleNoText);
  const placementDate = searchParams.get("placementDate") ?? "";
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [placementId, setPlacementId] = useState("");
  const [growingRows, setGrowingRows] = useState<GrowingHistoryRow[]>([]);
  const [layingRows, setLayingRows] = useState<EggLaying[]>([]);
  const [feedTypes, setFeedTypes] = useState<FeedType[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void refreshSessionx(router);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(async () => {
        if (
          !Number.isInteger(farmId) ||
          !Number.isInteger(buildingId) ||
          farmId <= 0 ||
          buildingId <= 0
        )
          throw new Error("Invalid building history link.");
        const rows = await listPlacementHistory({ farmId, buildingId });
        const scoped = rows.filter((row) =>
          cycleNo != null
            ? Number(row.cycle_no) === cycleNo
            : row.cycle_no == null && row.placement_date === placementDate,
        );
        if (!cancelled) {
          setPlacements(
            scoped.sort((left, right) =>
              (left.pen_no || "").localeCompare(right.pen_no || "", undefined, {
                numeric: true,
              }),
            ),
          );
          if (!scoped.length) setLoading(false);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load placement history.",
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [buildingId, cycleNo, farmId, placementDate]);

  const effectivePlacementId = placements.some(
    (row) => String(row.id) === placementId,
  )
    ? placementId
    : placements[0]
      ? String(placements[0].id)
      : "";

  useEffect(() => {
    if (!effectivePlacementId) return;
    let cancelled = false;
    Promise.resolve()
      .then(async () => {
        if (!cancelled) {
          setLoading(true);
          setError("");
        }
        if (mode === "growing") {
          const [rows, feeds] = await Promise.all([
            listDailyPerformance(Number(effectivePlacementId)),
            listFeedTypes(),
          ]);
          const selectedPlacement = placements.find(
            (row) => String(row.id) === effectivePlacementId,
          );
          if (!cancelled && selectedPlacement) {
            setGrowingRows(buildGrowingRows(selectedPlacement, rows));
            setFeedTypes(feeds);
            setLayingRows([]);
          }
        } else {
          // Laying production belongs to the building/cycle. It may have been
          // entered from any pen placement represented by this history row.
          const rows = await listEggLayingsByPlacements(
            placements.map((row) => row.id),
          );
          if (!cancelled) {
            setLayingRows(rows);
            setGrowingRows([]);
          }
        }
      })
      .catch((loadError) => {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load history.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectivePlacementId, mode, placements]);

  const placement = placements.find(
    (row) => String(row.id) === effectivePlacementId,
  );
  const filteredGrowing = useMemo(
    () => growingRows.filter((row) => inRange(row.daterec, fromDate, toDate)),
    [fromDate, growingRows, toDate],
  );
  const filteredLaying = useMemo(
    () =>
      layingRows.filter((row) => inRange(row.date_laying, fromDate, toDate)),
    [fromDate, layingRows, toDate],
  );
  const cumulative = useMemo(
    () =>
      new Map(
        growingRows.map((row, index) => {
          const throughCurrent = growingRows.slice(0, index + 1);
          return [
            row.daterec,
            {
              male: throughCurrent.reduce(
                (sum, item) => sum + number(item.mc_male),
                0,
              ),
              female: throughCurrent.reduce(
                (sum, item) => sum + number(item.mc_female),
                0,
              ),
            },
          ];
        }),
      ),
    [growingRows],
  );
  const feedById = useMemo(
    () => new Map(feedTypes.map((feed) => [feed.id, feed.description ?? ""])),
    [feedTypes],
  );
  const latestGrowing = growingRows.at(-1);
  const totalEggs = filteredLaying.reduce(
    (sum, row) => sum + number(row.tep_collection),
    0,
  );

  function switchMode(nextMode: HistoryMode) {
    const query = new URLSearchParams(searchParams.toString());
    query.set("mode", nextMode);
    router.replace(`/jmb/placement/history?${query.toString()}`);
  }

  return (
    <div className="h-screen w-full bg-slate-100 p-4 dark:bg-background">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-white dark:bg-card">
        <header className="shrink-0 border-b bg-white px-4 py-3 dark:bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">
                {mode === "growing" ? "Population Record" : "Egg Laying Record"}
              </h1>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Farm / Pen · History
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "growing" ? "default" : "outline"}
                onClick={() => switchMode("growing")}
              >
                <FileSpreadsheet className="size-4" />
                Growing
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "laying" ? "default" : "outline"}
                onClick={() => switchMode("laying")}
              >
                <Egg className="size-4" />
                Laying
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => router.push("/jmb/placement")}
              >
                <ArrowLeft className="size-4" />
                Placement List
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 border-t pt-3 md:grid-cols-3 xl:grid-cols-5">
            <ReadOnlyField label="Farm" value={placement?.farm_name || "-"} />
            <ReadOnlyField
              label="Building"
              value={placement?.building_no || "-"}
            />
            <label className="space-y-1 text-xs font-medium">
              <span>Pen</span>
              <select
                value={effectivePlacementId}
                onChange={(event) => setPlacementId(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {placements.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.pen_no || `Pen ${row.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium">
              <span>From date</span>
              <Input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-xs font-medium">
              <span>To date</span>
              <Input
                type="date"
                min={fromDate || undefined}
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Summary
              label="Placement date"
              value={formatDate(placement?.placement_date)}
            />
            <Summary
              label="Placed birds"
              value={count(
                placementInventory(placement, "male") +
                  placementInventory(placement, "female"),
              )}
            />
            <Summary label="Cycle #" value={String(cycleNo ?? "-")} />
            {mode === "growing" ? (
              <>
                <Summary
                  label="Female live / Mortality"
                  value={`${count(liveInventory(latestGrowing, "female"))} / ${count(cumulative.get(latestGrowing?.daterec ?? "")?.female)}`}
                />
                <Summary
                  label="Male live / Mortality"
                  value={`${count(liveInventory(latestGrowing, "male"))} / ${count(cumulative.get(latestGrowing?.daterec ?? "")?.male)}`}
                />
                <Summary
                  label="Daily rows"
                  value={String(filteredGrowing.length)}
                />
              </>
            ) : (
              <>
                <Summary
                  label="Total egg production"
                  value={count(totalEggs)}
                />
                <Summary
                  label="Daily rows"
                  value={String(filteredLaying.length)}
                />
              </>
            )}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto bg-white dark:bg-card">
          {loading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading history...
            </div>
          ) : error ? (
            <div className="m-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : mode === "growing" ? (
            <GrowingGrid
              rows={filteredGrowing}
              placement={placement}
              cumulative={cumulative}
              feedById={feedById}
            />
          ) : (
            <LayingGrid rows={filteredLaying} placements={placements} />
          )}
        </main>
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="space-y-1 text-xs font-medium">
      <span>{label}</span>
      <Input value={value} readOnly className="bg-muted/30" />
    </label>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-37.5 rounded-md border bg-slate-50 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

const growingGroups = [
  "Inventory (pc)",
  "Mortality (pc)",
  "Cumm Mortality (pc)",
  "Culls (pc)",
  "Transfer In (pc)",
  "Transfer Out (pc)",
  "Kitchen (pc)",
  "Condem (pc)",
  "Grams/Birds (kg/pc)",
  "Feeds Consumption (kg)",
];

function hasDailyRecord(row: GrowingHistoryRow) {
  return (
    row.id != null ||
    Object.keys(zeroDailyFields).some(
      (field) => number(row[field as keyof GrowingHistoryRow]) !== 0,
    ) ||
    row.male_feedtype_id != null ||
    row.female_feedtype_id != null
  );
}

function GrowingGrid({
  rows,
  placement,
  cumulative,
  feedById,
}: {
  rows: GrowingHistoryRow[];
  placement?: Placement;
  cumulative: Map<string, { male: number; female: number }>;
  feedById: Map<number, string>;
}) {
  const latest = rows.at(-1);
  const totals = rows.reduce(
    (total, row) => ({
      mcMale: total.mcMale + number(row.mc_male),
      mcFemale: total.mcFemale + number(row.mc_female),
      cullMale: total.cullMale + number(row.cull_male),
      cullFemale: total.cullFemale + number(row.cull_female),
      inMale: total.inMale + number(row.trans_in_male),
      inFemale: total.inFemale + number(row.trans_in_female),
      outMale: total.outMale + number(row.trans_out_male),
      outFemale: total.outFemale + number(row.trans_out_female),
      kitchenMale: total.kitchenMale + number(row.kitchen_male),
      kitchenFemale: total.kitchenFemale + number(row.kitchen_female),
      condemMale: total.condemMale + number(row.condem_male),
      condemFemale: total.condemFemale + number(row.condem_female),
      feedMale: total.feedMale + number(row.feed_consumption_male),
      feedFemale: total.feedFemale + number(row.feed_consumption_female),
    }),
    {
      mcMale: 0,
      mcFemale: 0,
      cullMale: 0,
      cullFemale: 0,
      inMale: 0,
      inFemale: 0,
      outMale: 0,
      outFemale: 0,
      kitchenMale: 0,
      kitchenFemale: 0,
      condemMale: 0,
      condemFemale: 0,
      feedMale: 0,
      feedFemale: 0,
    },
  );
  const footerValues = [
    liveInventory(latest, "male"),
    liveInventory(latest, "female"),
    totals.mcMale,
    totals.mcFemale,
    cumulative.get(latest?.daterec ?? "")?.male ?? 0,
    cumulative.get(latest?.daterec ?? "")?.female ?? 0,
    totals.cullMale,
    totals.cullFemale,
    totals.inMale,
    totals.inFemale,
    totals.outMale,
    totals.outFemale,
    totals.kitchenMale,
    totals.kitchenFemale,
    totals.condemMale,
    totals.condemFemale,
    latest?.avg_body_weight_male ?? 0,
    latest?.avg_body_weight_female ?? 0,
    totals.feedMale,
    totals.feedFemale,
  ];

  return (
    <table
      className="fc-grid-table table-fixed border-separate border-spacing-0 caption-bottom text-sm"
      style={{ minWidth: 2108 }}
    >
      <colgroup>
        <col style={{ width: 132 }} />
        <col style={{ width: 52 }} />
        {[
          92, 92, 76, 76, 92, 92, 76, 76, 82, 82, 82, 82, 82, 82, 82, 82, 100,
          100, 180, 180,
        ].map((width, index) => (
          <col key={index} style={{ width }} />
        ))}
      </colgroup>
      <thead>
        <tr style={{ height: 28 }}>
          <th
            rowSpan={2}
            className="fc-grid-header fc-grid-header-border sticky left-0 top-0 z-40 text-center text-xs"
            style={{ minWidth: 132 }}
          >
            Date
          </th>
          <th
            rowSpan={2}
            className="fc-grid-header fc-grid-age-header fc-grid-header-border sticky left-33 top-0 z-40 text-center text-xs"
            style={{ minWidth: 52 }}
          >
            Age
          </th>
          {growingGroups.map((label) => (
            <th
              key={label}
              colSpan={2}
              className={`${headerClass(true)} fc-grid-header-group capitalize`}
              style={{ top: 0 }}
            >
              {label}
            </th>
          ))}
        </tr>
        <tr style={{ height: 28 }}>
          {Array.from({ length: 10 }, (_, groupIndex) =>
            ["Male", "Female"].map((label, sexIndex) => (
              <th
                key={`${groupIndex}-${label}`}
                className={headerClass(sexIndex === 1)}
                style={{ top: 28 }}
              >
                {label}
              </th>
            )),
          )}
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((row, rowIndex) => {
            const cumulativeRow = cumulative.get(row.daterec);
            const recorded = hasDailyRecord(row);
            const values: Array<string | number> = [
              row.inv_male,
              row.inv_female,
              row.mc_male || "",
              row.mc_female || "",
              recorded ? (cumulativeRow?.male ?? 0) : "",
              recorded ? (cumulativeRow?.female ?? 0) : "",
              row.cull_male || "",
              row.cull_female || "",
              row.trans_in_male || "",
              row.trans_in_female || "",
              row.trans_out_male || "",
              row.trans_out_female || "",
              row.kitchen_male || "",
              row.kitchen_female || "",
              row.condem_male || "",
              row.condem_female || "",
              row.avg_body_weight_male || "",
              row.avg_body_weight_female || "",
              row.feed_consumption_male || row.male_feedtype_id
                ? `${row.feed_consumption_male || ""}${row.male_feedtype_id ? ` / ${feedById.get(row.male_feedtype_id) ?? ""}` : ""}`
                : "",
              row.feed_consumption_female || row.female_feedtype_id
                ? `${row.feed_consumption_female || ""}${row.female_feedtype_id ? ` / ${feedById.get(row.female_feedtype_id) ?? ""}` : ""}`
                : "",
            ];
            const divider =
              rowIndex % 5 === 4
                ? "fc-grid-row-divider-strong"
                : "fc-grid-row-divider";
            return (
              <tr key={row.id ?? row.daterec} className="fc-grid-row border-0">
                <td
                  className={`fc-grid-age sticky left-0 z-20 p-0 text-center font-semibold ${divider}`}
                  style={{ minWidth: 132 }}
                >
                  <Input
                    type="date"
                    value={normalizeDate(row.daterec)}
                    readOnly
                    className="h-8 rounded-none border-0 bg-transparent px-1 text-center text-xs shadow-none focus-visible:ring-0"
                  />
                </td>
                <td
                  className={`fc-grid-age sticky left-33 z-20 p-0 text-center font-semibold ${divider}`}
                  style={{ minWidth: 52 }}
                >
                  <div className="flex h-8 items-center justify-center">
                    {ageOn(placement?.placement_date, row.daterec)}
                  </div>
                </td>
                {values.map((value, index) => (
                  <td
                    key={index}
                    className={`fc-grid-cell fc-grid-cell-readonly p-0 text-center tabular-nums ${index % 2 === 1 ? "fc-grid-group-divider" : "fc-grid-border-r"} ${divider}`}
                  >
                    <div className="flex h-8 items-center justify-center px-1">
                      {typeof value === "number" ? count(value) : value}
                    </div>
                  </td>
                ))}
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={22} className="h-40 text-center text-muted-foreground">
              No Growing records in the selected date range.
            </td>
          </tr>
        )}
      </tbody>
      {rows.length ? (
        <tfoot>
          <tr>
            <td className="fc-grid-footer-cell sticky bottom-0 left-0 z-40 h-9 text-center font-semibold">
              Total
            </td>
            <td className="fc-grid-footer-cell fc-grid-footer-age sticky bottom-0 left-33 z-40 text-center font-semibold">
              {rows.length} days
            </td>
            {footerValues.map((value, index) => (
              <td
                key={index}
                className={`fc-grid-footer-cell sticky bottom-0 text-center font-semibold ${index % 2 === 1 ? "fc-grid-group-divider" : "fc-grid-border-r"}`}
              >
                {count(value)}
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

function LayingGrid({
  rows,
  placements,
}: {
  rows: EggLaying[];
  placements: Placement[];
}) {
  const placementById = new Map(placements.map((item) => [item.id, item]));
  const numberFields: Array<
    keyof Pick<
      EggLaying,
      | "tep_collection"
      | "hatching_egg"
      | "table_egg"
      | "classb"
      | "crack"
      | "junior"
      | "jumbo"
      | "condemn"
    >
  > = [
    "tep_collection",
    "hatching_egg",
    "table_egg",
    "classb",
    "crack",
    "junior",
    "jumbo",
    "condemn",
  ];
  const totals = numberFields.map((field) =>
    rows.reduce((sum, row) => sum + number(row[field]), 0),
  );
  const totalClassifications = totals
    .slice(1)
    .reduce((sum, value) => sum + value, 0);
  const headers = [
    "Date Laying",
    "Age",
    "TEP Collection",
    "Hatching Egg",
    "Table Egg",
    "Class B",
    "Crack",
    "Junior",
    "Jumbo",
    "Condemn",
    "Total Egg Classification",
  ];

  return (
    <section className="space-y-3 p-4">
      <div>
        <h2 className="text-sm font-medium">Egg Laying Production History</h2>
        <p className="text-xs text-muted-foreground">
          Saved egg production records for the selected building and cycle.
        </p>
      </div>
      <div className="max-h-130 w-full overflow-x-hidden overflow-y-auto bg-white dark:bg-card">
        <table className="fc-grid-table w-full table-fixed border-separate border-spacing-0 caption-bottom text-sm">
          <colgroup>
            <col style={{ width: "12%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "11%" }} />
            {Array.from({ length: 7 }, (_, index) => (
              <col key={index} style={{ width: "8%" }} />
            ))}
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr style={{ height: 36 }}>
              {headers.map((label, index) => (
                <th
                  key={label}
                  style={index === 1 ? { left: "12%" } : undefined}
                  className={`fc-grid-header fc-grid-header-border sticky top-0 px-1 py-0 text-center text-[10px] font-semibold leading-tight ${index === 0 ? "left-0 z-40 fc-grid-border-r" : index === 1 ? "z-40 fc-grid-age-header" : "z-30 fc-grid-border-r"}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => {
                const classification =
                  number(row.hatching_egg) +
                  number(row.table_egg) +
                  number(row.classb) +
                  number(row.crack) +
                  number(row.junior) +
                  number(row.jumbo) +
                  number(row.condemn);
                const divider =
                  rowIndex % 5 === 4
                    ? "fc-grid-row-divider-strong"
                    : "fc-grid-row-divider";
                return (
                  <tr key={row.id} className="fc-grid-row border-0">
                    <td
                      className={`fc-grid-cell fc-grid-cell-readonly sticky left-0 z-20 p-0 fc-grid-border-r ${divider}`}
                    >
                      <Input
                        type="date"
                        value={normalizeDate(row.date_laying)}
                        readOnly
                        className="h-8 min-w-0 rounded-none border-0 bg-transparent px-0.5 text-center text-[10px] shadow-none focus-visible:ring-0"
                      />
                    </td>
                    <td
                      style={{ left: "12%" }}
                      className={`fc-grid-age sticky z-20 p-0 text-center text-xs font-semibold ${divider}`}
                    >
                      <div className="flex h-8 items-center justify-center">
                        {ageOn(
                          placementById.get(number(row.placement_id))
                            ?.placement_date,
                          row.date_laying,
                        )}
                      </div>
                    </td>
                    {numberFields.map((field) => (
                      <td
                        key={field}
                        className={`fc-grid-cell fc-grid-cell-readonly p-0 text-center tabular-nums fc-grid-border-r ${divider}`}
                      >
                        <div className="flex h-8 items-center justify-center px-0.5">
                          {count(row[field])}
                        </div>
                      </td>
                    ))}
                    <td
                      className={`fc-grid-cell fc-grid-cell-readonly p-0 text-center font-semibold tabular-nums fc-grid-border-r ${divider}`}
                    >
                      <div className="flex h-8 items-center justify-center px-0.5">
                        {count(classification)}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={headers.length}
                  className="h-40 text-center text-muted-foreground"
                >
                  No Laying records in the selected date range.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="fc-grid-footer-cell sticky bottom-0 left-0 z-40 h-9 text-center font-semibold">
                Total
              </td>
              <td
                style={{ left: "12%" }}
                className="fc-grid-footer-cell fc-grid-footer-age sticky bottom-0 z-40 text-center text-xs font-semibold"
              >
                {rows.length} row{rows.length === 1 ? "" : "s"}
              </td>
              {totals.map((value, index) => (
                <td
                  key={numberFields[index]}
                  className="fc-grid-footer-cell fc-grid-border-r sticky bottom-0 text-center font-semibold tabular-nums"
                >
                  {count(value)}
                </td>
              ))}
              <td className="fc-grid-footer-cell fc-grid-border-r sticky bottom-0 text-center font-semibold tabular-nums">
                {count(totalClassifications)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
