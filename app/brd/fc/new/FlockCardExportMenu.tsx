"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, ClipboardCopy, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

type ExportRow = {
  age: number;
  values: string[];
};

type FlockCardExportMenuProps = {
  farmLabel: string;
  buildingLabel: string;
  flockCode: string;
  animalSummary: string;
  feedSummary: string;
  batchSummary: string;
  rows: ExportRow[];
};

const exportHeaders = [
  "Age",
  "Mortality AM",
  "Mortality PM",
  "Mortality Total",
  "Thinning AM",
  "Thinning PM",
  "Total",
  "DOC Batch",
  "Cumulative",
  "Feed Intake Daily kg/Flock",
  "Feed Intake Daily per Bird g/b",
  "Feed Intake Guideline g/b/d",
  "Feed Intake Feeds Batch",
  "Water Intake Daily L/Flock",
  "Water Intake Daily per Bird",
  "Body Weight g",
  "Body Weight Guideline g",
  "Temp AM C",
  "Temp PM C",
  "Humidity Min %",
  "Humidity Max %",
  "NH3 Max ppm",
  "Skin Color B (yellow)",
  "Skin Color A (red)",
  "Skin Color L (luminosity)",
  "Spacer 1",
  "Spacer 2",
  "Spacer 3",
  "Spacer 4",
  "Water Intake Guideline ml/b/d",
];

function escapeTabDelimitedValue(value: unknown) {
  return String(value ?? "").replace(/\r?\n/g, " ").replace(/\t/g, " ");
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getFileSafeName(value: string) {
  const normalized = value.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "");
  return normalized || "flock-card";
}

function buildTabDelimitedText(rows: ExportRow[]) {
  return [
    exportHeaders.map(escapeTabDelimitedValue).join("\t"),
    ...rows.map(row => [row.age, ...row.values].map(escapeTabDelimitedValue).join("\t")),
  ].join("\n");
}

function buildHtmlTable({
  farmLabel,
  buildingLabel,
  flockCode,
  animalSummary,
  feedSummary,
  batchSummary,
  rows,
}: FlockCardExportMenuProps) {
  const contextRows = [
    ["Farm", farmLabel],
    ["Building", buildingLabel],
    ["Flock", flockCode],
    ["Animals", animalSummary],
    ["Feed", feedSummary],
    ["Batches", batchSummary],
  ];

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(flockCode || "Flock Card")}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    table { border-collapse: collapse; width: 100%; font-size: 11px; }
    th, td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; }
    th { background: #f3f4f6; font-weight: 700; }
    .context { width: auto; margin-bottom: 12px; }
    .context th { width: 90px; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(flockCode || "Flock Card")}</h1>
  <table class="context">
    <tbody>
      ${contextRows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}
    </tbody>
  </table>
  <table>
    <thead>
      <tr>${exportHeaders.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows.map(row => `<tr>${[row.age, ...row.values].map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function FlockCardExportMenu(props: FlockCardExportMenuProps) {
  const filenameBase = getFileSafeName(props.flockCode);

  async function copyTabDelimitedText() {
    try {
      await navigator.clipboard.writeText(buildTabDelimitedText(props.rows));
      toast("Tab-delimited text copied. Paste it into Excel.");
    } catch (error) {
      console.error(error);
      toast("Unable to copy export text.");
    }
  }

  function exportExcel() {
    downloadFile(
      `${filenameBase}.xls`,
      buildHtmlTable(props),
      "application/vnd.ms-excel;charset=utf-8"
    );
    toast("Excel export downloaded.");
  }

  function exportPdf() {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!printWindow) {
      toast("Unable to open print window.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildHtmlTable(props));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Export as
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuItem onSelect={() => void copyTabDelimitedText()}>
              <ClipboardCopy className="size-4" />
              Text tab delimited
            </DropdownMenuItem>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-64">
            Copies rows as tab-separated text so columns line up when pasted into Excel.
          </TooltipContent>
        </Tooltip>

        <DropdownMenuItem onSelect={exportExcel}>
          <FileSpreadsheet className="size-4" />
          Export as Excel
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={exportPdf}>
          <FileText className="size-4" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
