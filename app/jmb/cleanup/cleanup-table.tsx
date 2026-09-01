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
      setError("Unable to load breeder clean-ups from tbl_breeder_cleanup.");
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
          record.pen_name,
          record.reason,
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
        `Delete the clean-up record for cycle ${record.cycle_no ?? record.cycle_id}?`,
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
          : "Unable to delete clean-up.",
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
          CurrentPageName="Clean-Up"
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
                <h1 className="text-xl font-semibold">Breeder clean-up</h1>
                <p className="text-sm text-muted-foreground">
                  Cycle clean-up quantities and captured flock-card balances
                </p>
              </div>
            </div>
            <Button onClick={() => router.push("/jmb/cleanup/new")}>
              <Plus className="size-4" />
              New clean-up
            </Button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Clean-up records" value={records.length} />
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
              placeholder="Search cycle, farm, location, or reason..."
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
          <Table className="min-w-275">
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Farm</TableHead>
                <TableHead>Building / pen</TableHead>
                <TableHead className="text-right">Female system</TableHead>
                <TableHead className="text-right">Female clean-up</TableHead>
                <TableHead className="text-right">Male system</TableHead>
                <TableHead className="text-right">Male clean-up</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : null}
              {!loading &&
                filtered.map((record) => (
                  <TableRow key={record.id}>
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
                      <div className="text-xs text-muted-foreground">
                        {record.pen_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {record.female_system_balance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {record.female_cleanup_qty.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {record.male_system_balance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {record.male_cleanup_qty.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div>{record.reason}</div>
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
                    colSpan={10}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No breeder clean-up records found.
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
