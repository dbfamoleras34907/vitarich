import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COBB_BODY_WEIGHT_SOURCES, cobbBodyWeightTarget } from "@/app/jmb/lib/data/queries/cobb500BreederBodyWeight";
import type { BreederWeeklyBodyWeight } from "./api";

const grams = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const signed = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, signDisplay: "exceptZero" });

export default function BreederBodyWeight({ rows, loading, asOf }: {
  rows: BreederWeeklyBodyWeight[];
  loading: boolean;
  asOf?: string;
}) {
  return (
    <section className="space-y-4" aria-busy={loading}>
      <div>
        <h2 className="text-lg font-semibold">Latest Weekly Body Weight vs COBB 500</h2>
        <p className="text-sm text-muted-foreground">
          Latest recorded weighing for each sex and placement through {asOf ?? "the selected end date"}, including earlier records.
          Age is Weeks.Day; placement day is 0.1. Targets use the completed week (25.3 uses week 25).
          No target is available below 1.0 or above 65.0.
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {(["male", "female"] as const).map(sex => (
          <Card key={sex}>
            <CardHeader>
              <CardTitle>{sex === "male" ? "Male Body Weight" : "Female Body Weight"}</CardTitle>
              <a href={COBB_BODY_WEIGHT_SOURCES[sex]} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                {sex === "male" ? "Cobb MX Male (2026) reference" : "COBB 500 Fast Feather (2026) standard"}
              </a>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Farm / Building / Pen</TableHead>
                  <TableHead>Weighed / Age</TableHead>
                  <TableHead className="text-right">Actual (g)</TableHead>
                  <TableHead className="text-right">Standard (g)</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={5}>Loading body weights...</TableCell></TableRow>
                    : !rows.length ? <TableRow><TableCell colSpan={5}>No placements found for the selected farm and end date.</TableCell></TableRow>
                    : rows.map(row => {
                      const reading = row[sex];
                      const target = cobbBodyWeightTarget(sex, reading?.ageDays ?? null);
                      const difference = reading && target ? reading.value - target.grams : null;
                      const old = reading && asOf && (Date.parse(asOf) - Date.parse(reading.date)) / 86_400_000 > 7;
                      return (
                        <TableRow key={row.placementId}>
                          <TableCell>
                            <div>{row.farmName}</div>
                            <div>{row.buildingName} / {row.penName}</div>
                            <div className="text-xs text-muted-foreground">Placement #{row.placementId}</div>
                          </TableCell>
                          <TableCell>
                            {reading ? <>
                              <div>{reading.date}</div>
                              <div>{reading.ageDays == null ? "Unknown age" : `${Math.floor(reading.ageDays / 7)}.${reading.ageDays % 7}`}</div>
                              {old ? <div className="text-xs text-amber-700">Over 7 days old</div> : null}
                            </> : "Not recorded"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{reading ? grams.format(reading.value) : "—"}</TableCell>
                          <TableCell className="text-right">
                            {target ? <>{grams.format(target.grams)}<div className="text-xs text-muted-foreground">Week {target.week}</div></> : "N/A"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {difference != null && target ? <>
                              <div>{signed.format(difference)} g</div>
                              <div className="text-xs text-muted-foreground">{signed.format(difference / target.grams * 100)}%</div>
                            </> : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
