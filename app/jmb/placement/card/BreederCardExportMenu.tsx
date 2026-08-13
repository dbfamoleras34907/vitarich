"use client";

import { useRef } from "react";
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
import { ChevronDown, ClipboardCopy, Download, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { toast } from "sonner";

export type BreederExportRow = {
  age: number;
  date: string;
  values: Array<string | number>;
};

type Props = {
  farm: string;
  building: string;
  pen: string;
  placementDate: string;
  placedBirds: number;
  liveBirds: number;
  rows: BreederExportRow[];
  templateRows: BreederImportRow[];
  importing?: boolean;
  onImport: (file: File) => Promise<void>;
};

export type BreederImportRow = {
  daterec: string;
  inv_male: number;
  inv_female: number;
  mc_male: number;
  mc_female: number;
  cull_male: number;
  cull_female: number;
  trans_in_male: number;
  trans_in_female: number;
  trans_out_male: number;
  trans_out_female: number;
  avg_body_weight_male: number;
  avg_body_weight_female: number;
  feed_consumption_male: number;
  feed_consumption_female: number;
  male_feedtype_id: number | null;
  female_feedtype_id: number | null;
};

export const BREEDER_IMPORT_HEADERS = [
  "daterec",
  "inv_male", "inv_female", "mc_male", "mc_female", "cull_male", "cull_female",
  "trans_in_male", "trans_in_female", "trans_out_male", "trans_out_female",
  "avg_body_weight_male", "avg_body_weight_female",
  "feed_consumption_male", "feed_consumption_female",
  "male_feedtype_id", "female_feedtype_id",
] as const;

const headers = [
  "Date", "Age",
  "Inventory Male", "Inventory Female",
  "MC Male", "MC Female", "Cumulative MC Male", "Cumulative MC Female",
  "Culls Male", "Culls Female", "Transfer In Male", "Transfer In Female",
  "Transfer Out Male", "Transfer Out Female", "Grams/Birds Male", "Grams/Birds Female",
  "FC Male", "FC Female",
];

function clean(value: unknown) {
  return String(value ?? "").replace(/\r?\n/g, " ").replace(/\t/g, " ");
}

function html(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function filename(value: string) {
  return value.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "breeder-card";
}

function tabText(rows: BreederExportRow[]) {
  return [
    headers.join("\t"),
    ...rows.map((row) => [row.date, row.age, ...row.values].map(clean).join("\t")),
  ].join("\n");
}

function htmlDocument(props: Props) {
  const context = [
    ["Farm", props.farm], ["Building", props.building], ["Pen", props.pen],
    ["Placement Date", props.placementDate], ["Placed Birds", props.placedBirds],
    ["Live Birds", props.liveBirds],
  ];
  return `<!doctype html><html><head><meta charset="utf-8" />
  <title>Breeder Card - ${html(props.pen)}</title>
  <style>body{font-family:Arial,sans-serif;color:#111827}h1{font-size:18px;margin:0 0 8px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #d1d5db;padding:4px 6px;text-align:left}th{background:#f3f4f6;font-weight:700}.context{width:auto;margin-bottom:12px}.context th{width:100px}@media print{body{margin:12mm}}</style>
  </head><body><h1>Breeder Daily Performance Card</h1>
  <table class="context"><tbody>${context.map(([label, value]) => `<tr><th>${html(label)}</th><td>${html(value)}</td></tr>`).join("")}</tbody></table>
  <table><thead><tr>${headers.map((header) => `<th>${html(header)}</th>`).join("")}</tr></thead>
  <tbody>${props.rows.map((row) => `<tr>${[row.date, row.age, ...row.values].map((value) => `<td>${html(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function BreederCardExportMenu(props: Props) {
  const base = filename(`${props.farm}-${props.building}-${props.pen}`);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(tabText(props.rows));
      toast("Tab-delimited text copied. Paste it into Excel.");
    } catch {
      toast("Unable to copy export text.");
    }
  }

  function exportExcel() {
    download(`${base}.xls`, htmlDocument(props), "application/vnd.ms-excel;charset=utf-8");
    toast("Excel export downloaded.");
  }

  function exportPdf() {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) return void toast("Unable to open print window.");
    printWindow.document.open();
    printWindow.document.write(htmlDocument(props));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function exportTemplate() {
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    const header = BREEDER_IMPORT_HEADERS.map((value) => ({
      value,
      type: String,
      fontWeight: "bold" as const,
      color: "#111827",
      backgroundColor: "#FACC15",
      align: "center" as const,
    }));
    const body = props.templateRows.map((row) => BREEDER_IMPORT_HEADERS.map((field) => {
      if (field === "daterec") {
        return { value: new Date(`${row.daterec}T00:00:00`), type: Date, format: "yyyy-mm-dd" };
      }
      const value = row[field];
      return {
        value: value ?? undefined,
        type: Number,
        format: field.includes("weight") || field.includes("consumption") ? "0.000" : "0",
      };
    }));
    const workbook = writeXlsxFile([header, ...body], {
      sheet: "Breeder Daily Performance",
      stickyRowsCount: 1,
      columns: BREEDER_IMPORT_HEADERS.map((headerName) => ({ width: headerName === "daterec" ? 15 : 22 })),
    });
    await workbook.toFile(`${base}-import-template.xlsx`);
    toast("Excel import template downloaded.");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">Export as <ChevronDown className="size-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => void exportTemplate()}>
          <Download className="size-4" /> Download import template
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={props.importing}
          onSelect={() => window.setTimeout(() => fileInputRef.current?.click(), 0)}
        >
          <Upload className="size-4" /> {props.importing ? "Importing..." : "Import Excel"}
        </DropdownMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuItem onSelect={() => void copyText()}><ClipboardCopy className="size-4" /> Text tab delimited</DropdownMenuItem>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-64">Copies rows as tab-separated text for Excel.</TooltipContent>
        </Tooltip>
        <DropdownMenuItem onSelect={exportExcel}><FileSpreadsheet className="size-4" /> Export as Excel</DropdownMenuItem>
        <DropdownMenuItem onSelect={exportPdf}><FileText className="size-4" /> Export as PDF</DropdownMenuItem>
      </DropdownMenuContent>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void props.onImport(file);
          event.currentTarget.value = "";
        }}
      />
    </DropdownMenu>
  );
}
