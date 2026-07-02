"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

const rows = Array.from({ length: 40 }, (_, i) => ({ age: i }));

function CellInput({ id }: { id: string }) {
  return (
    <Input
      id={id}
      name={id}
      className="h-8 min-w-[90px] rounded-none border-0 bg-transparent text-center shadow-none"
    />
  );
}

export default function StickyTablePage() {
  return (
    <div className="h-screen w-full bg-slate-100 p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-white">
        <div className="relative flex-1 overflow-auto">
          <Table className="min-w-[1800px] border-collapse">
            <TableHeader >
              <TableRow className="h-[44px] ">
                <TableHead
                  rowSpan={3}
                  className="sticky left-0 top-0 z-[80] w-[90px] min-w-[90px] border bg-slate-100 text-center shadow-md"
                >
                  Age
                </TableHead>

                {/* These headers are sticky top only, NOT left */}
                <TableHead
                  colSpan={3}
                  className="sticky top-0 z-[60] border bg-slate-100 text-center"
                >
                  Mortality
                </TableHead>

                <TableHead
                  colSpan={2}
                  className="sticky top-0 z-[60] border bg-slate-100 text-center"
                >
                  Selection
                </TableHead>

                <TableHead
                  colSpan={2}
                  className="sticky top-0 z-[60] border bg-slate-100 text-center"
                >
                  Total
                </TableHead>

                <TableHead
                  colSpan={1}
                  className="sticky top-0 z-[60] border bg-slate-100 text-center"
                >
                  Thinning
                </TableHead>

                <TableHead
                  colSpan={3}
                  className="sticky top-0 z-[60] border bg-slate-100 text-center"
                >
                  Feed Intake
                </TableHead>

                <TableHead
                  colSpan={2}
                  className="sticky top-0 z-[60] border bg-slate-100 text-center"
                >
                  Water Intake
                </TableHead>

                <TableHead
                  colSpan={2}
                  className="sticky top-0 z-[60] border bg-slate-100 text-center"
                >
                  Body Weight
                </TableHead>
              </TableRow>

              <TableRow className="h-[44px]">
                <TableHead
                  colSpan={3}
                  className="sticky top-[44px] z-[60] border bg-slate-100 text-center"
                >
                  Deaths
                </TableHead>

                <TableHead
                  colSpan={2}
                  className="sticky top-[44px] z-[60] border bg-slate-100 text-center"
                >
                  Other
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="sticky top-[44px] z-[60] min-w-[120px] border bg-slate-100 text-center"
                >
                  Total
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="sticky top-[44px] z-[60] min-w-[120px] border bg-slate-100 text-center"
                >
                  Cumulative
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="sticky top-[44px] z-[60] min-w-[120px] border bg-slate-100 text-center"
                >
                  Thinning
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="sticky top-[44px] z-[60] min-w-[140px] border bg-slate-100 text-center"
                >
                  Daily kg/Flock
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="sticky top-[44px] z-[60] min-w-[140px] border bg-slate-100 text-center"
                >
                  Daily per Bird
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="sticky top-[44px] z-[60] min-w-[120px] border bg-slate-100 text-center"
                >
                  Guideline
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="sticky top-[44px] z-[60] min-w-[140px] border bg-slate-100 text-center"
                >
                  Daily L/Flock
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="sticky top-[44px] z-[60] min-w-[140px] border bg-slate-100 text-center"
                >
                  Daily per Bird
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="sticky top-[44px] z-[60] min-w-[120px] border bg-slate-100 text-center"
                >
                  Weight
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="sticky top-[44px] z-[60] min-w-[120px] border bg-slate-100 text-center"
                >
                  Guideline
                </TableHead>
              </TableRow>

              <TableRow className="h-[44px]">
                <TableHead className="sticky top-[88px] z-[60] min-w-[100px] border bg-slate-100 text-center">
                  AM
                </TableHead>
                <TableHead className="sticky top-[88px] z-[60] min-w-[100px] border bg-slate-100 text-center">
                  PM
                </TableHead>
                <TableHead className="sticky top-[88px] z-[60] min-w-[100px] border bg-slate-100 text-center">
                  Total
                </TableHead>
                <TableHead className="sticky top-[88px] z-[60] min-w-[100px] border bg-slate-100 text-center">
                  AM
                </TableHead>
                <TableHead className="sticky top-[88px] z-[60] min-w-[100px] border bg-slate-100 text-center">
                  PM
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={row.age}>
                  <TableCell className="sticky left-0 z-[50] w-[90px] min-w-[90px] border bg-white text-center font-semibold shadow-md">
                    {row.age}
                  </TableCell>

                  {Array.from({ length: 16 }).map((_, colIndex) => (
                    <TableCell key={colIndex} className="border p-0">
                      <CellInput id={`row-${rowIndex}-col-${colIndex}`} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>

            <TableFooter>
              <TableRow>
                <TableCell className="sticky bottom-0 left-0 z-[80] border bg-slate-900 text-center font-semibold text-white shadow-md">
                  Total
                </TableCell>

                <TableCell
                  colSpan={16}
                  className="sticky bottom-0 z-[70] border bg-slate-900 text-right text-white"
                >
                  Floating footer
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}