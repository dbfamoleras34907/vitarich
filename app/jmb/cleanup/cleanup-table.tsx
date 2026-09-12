"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bird,
  ClipboardCheck,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { refreshSessionx } from "@/app/admin/user/RefreshSession";
import SearchableCombobox from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Breadcrumb from "@/lib/Breadcrumb";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import {
  deleteBreederCleanup,
  listBreederCleanups,
  type BreederCleanupRecord,
} from "./new/api";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

export default function CleanupTable() {
  const router = useRouter();
  const { setValue } = useGlobalContext();
  const [records, setRecords] = useState<BreederCleanupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [farmFilter, setFarmFilter] = useState("");

  useEffect(() => {
    void refreshSessionx(router);
  }, [router]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRecords(await listBreederCleanups());
    } catch (loadError) {
      console.error(loadError);
      setError("Unable to load breeder Terminal Culling records from tbl_breeder_cleanup.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    router.prefetch("/jmb/cleanup/new");
  }, [load, router]);
  useEffect(
    () => setValue("loading_g", loading || working),
    [loading, setValue, working],
  );

  const farms = useMemo(() => {
    const unique = new Map<number, BreederCleanupRecord>();
    records.forEach((record) => unique.set(record.farm_id, record));
    return [
      { code: "__all__", name: "All farms" },
      ...[...unique.values()].map((record) => ({
        code: String(record.farm_id),
        name: record.farm_code
          ? `${record.farm_code} - ${record.farm_name}`
          : record.farm_name,
      })),
    ];
  }, [records]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (
        farmFilter &&
        farmFilter !== "__all__" &&
        String(record.farm_id) !== farmFilter
      )
        return false;
      return (
        !query ||
        [
          record.cycle_no,
          record.farm_name,
          record.building_name,
          record.age,
          record.date_of_culling,
          record.body_weight,
          record.buyer_name,
          record.hauler_name,
          record.hauler_plate_number,
          record.remarks,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query),
        )
      );
    });
  }, [farmFilter, records, search]);

  async function remove(record: BreederCleanupRecord) {
    if (
      !window.confirm(
        `Delete the Terminal Culling record for cycle ${record.cycle_no ?? record.cycle_id}?`,
      )
    )
      return;
    setWorking(true);
    setError("");
    try {
      await deleteBreederCleanup(record.id);
      await load();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete Terminal Culling.",
      );
    } finally {
      setWorking(false);
    }
  }

  const femaleTotal = records.reduce(
    (sum, row) => sum + Number(row.female_cleanup_qty),
    0,
  );
  const maleTotal = records.reduce(
    (sum, row) => sum + Number(row.male_cleanup_qty),
    0,
  );

  return (
    <main className="min-h-[calc(100vh-4rem)] pb-10">
      <div className="mt-4 px-4">
        <Breadcrumb
          SecondPreviewPageName="Breeder"
          CurrentPageName="Terminal Culling"
        />
      </div>
      <section className="m-3 mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/30 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <ClipboardCheck className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Breeder Terminal Culling</h1>
                <p className="text-sm text-muted-foreground">
                  Cycle Terminal Culling quantities and captured flock-card balances
                </p>
              </div>
            </div>
            <Button onClick={() => router.push("/jmb/cleanup/new")}>
              <Plus className="size-4" />
              New Terminal Culling
            </Button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Terminal Culling records" value={records.length} />
            <Stat label="Female cleaned up" value={femaleTotal} />
            <Stat label="Male cleaned up" value={maleTotal} />
          </div>
        </div>
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search building, cycle, buyer, hauler, or remarks..."
              className="pl-9"
            />
          </div>
          <SearchableCombobox
            label="Farm"
            items={farms}
            value={farmFilter}
            onValueChange={setFarmFilter}
            placeholder="All farms"
            showCode
            className="w-full lg:w-72"
          />
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        {error ? (
          <div className="m-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <Table className="w-full text-xs [&_th]:px-1 [&_th]:whitespace-normal [&_th]:leading-tight [&_td]:px-1 [&_td]:py-1">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" rowSpan={2} className="w-12 text-center">#</TableHead>
                {["Created", "Cycle", "Farm", "Building", "Age", "Date of Culling"].map(label => <TableHead key={label} scope="col" rowSpan={2}>{label}</TableHead>)}
                <TableHead scope="colgroup" colSpan={3} className="bg-pink-100 text-center text-pink-900">Female</TableHead>
                <TableHead scope="colgroup" colSpan={3} className="bg-sky-100 text-center text-sky-900">Male</TableHead>
                {["Body Weights", "Buyer Name", "Hauler Name", "Plate Number", "Remarks", "Actions"].map(label => <TableHead key={label} scope="col" rowSpan={2}>{label}</TableHead>)}
              </TableRow>
              <TableRow>
                {["Female", "Male"].flatMap(sex => ["Balance", "Culling Qty", "Condemn Variance"].map(label => <TableHead key={sex + label} scope="col" className={`min-w-24 text-right ${sex === "Female" ? "bg-pink-100 text-pink-900" : "bg-sky-100 text-sky-900"}`}>{label}</TableHead>))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={19} className="h-32 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : null}
              {!loading &&
                filtered.map((record, index) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-center font-medium tabular-nums text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(record.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        Cycle {record.cycle_no ?? record.cycle_id}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {record.cycle_status || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{record.farm_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {record.farm_code || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{record.building_name}</div>

                    </TableCell>
                    <TableCell className="whitespace-nowrap">{record.age ?? "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{record.date_of_culling ?? "-"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {record.female_system_balance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {record.female_cleanup_qty.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{(record.female_condemn_variance ?? record.female_system_balance - record.female_cleanup_qty).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {record.male_system_balance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {record.male_cleanup_qty.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{(record.male_condemn_variance ?? record.male_system_balance - record.male_cleanup_qty).toLocaleString()}</TableCell>
                    <TableCell>{record.body_weight || "-"}</TableCell>
                    <TableCell>{record.buyer_name || "-"}</TableCell>
                    <TableCell>{record.hauler_name || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{record.hauler_plate_number || "-"}</TableCell>
                    <TableCell>
                      {record.remarks ? (
                        <div className="max-w-64 truncate text-xs text-muted-foreground">
                          {record.remarks}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            router.push(`/jmb/cleanup/new?id=${record.id}`)
                          }
                        >
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => void remove(record)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              {!loading && !filtered.length ? (
                <TableRow>
                  <TableCell
                    colSpan={19}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No breeder Terminal Culling records found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <div className="border-t px-4 py-3 text-sm text-muted-foreground">
          Showing {filtered.length} of {records.length} records
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bird className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </div>
    </div>
  );
}
