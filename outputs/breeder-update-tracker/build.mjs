import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/ProjectVitarich/fms/vitarich/outputs/breeder-update-tracker";
const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Breeder Updates");
sheet.showGridLines = false;

const rows = [
  ["Breeder Management", "Created the main Breeder module, landing page, navigation, and module grouping.", new Date("2026-04-16T00:00:00"), "Done"],
  ["Breeder Placement", "Create, edit, view, and list placements with farm, building, pen, breed, flock, warehouse, sex quantities, body weights, and breeder-cycle tracking.", new Date("2026-08-20T00:00:00"), "Done"],
  ["Population Record / Flock Card", "Daily male and female inventory, mortality, culls, transfers, kitchen/condemned quantities, body weight, feed consumption, balances, and export.", new Date("2026-08-20T00:00:00"), "Done"],
  ["Bird Transfer", "Transfer male and female birds between active placements with availability validation, reason, remarks, and automatic transfer-in/out posting.", new Date("2026-08-20T00:00:00"), "Done"],
  ["Placement History", "Consolidated placement, population, growing, egg-laying, feed, body-weight, mortality, cull, and transfer history with filters.", new Date("2026-08-20T00:00:00"), "Done"],
  ["Growing Period", "Daily growing records by farm, building, and pen with automatic flock age, population, feed, performance monitoring, and batch entry.", new Date("2026-08-05T00:00:00"), "Done"],
  ["Grading", "Breeder grading transactions by placement and pen with placement lookup, quantities, and automatic age calculation.", new Date("2026-06-25T00:00:00"), "Done"],
  ["Laying Production", "Daily egg production for hatching, table, cracked, soft-shell, rejected, and condemned eggs with totals and breeder-cycle linkage.", new Date("2026-08-20T00:00:00"), "Done"],
  ["Vaccination", "Farm/building/pen coverage, vaccine and batch details, dosage, route, booster schedule, expiry checks, bird reconciliation, and verification.", new Date("2026-08-17T00:00:00"), "Done"],
  ["Medication", "Farm/building/pen coverage, medication details, dosage, route, treatment period, indication, prescriber, administrator, and remarks.", new Date("2026-08-17T00:00:00"), "Done"],
  ["Breeder Dispatch", "Population and egg dispatch with hatchery destination, vehicle traceability, filters, balance validation, draft/post/cancel, and printable slip.", new Date("2026-08-20T00:00:00"), "Done"],
  ["Breeder Clean-Up", "Cycle and pen clean-up with system-versus-actual male/female quantities, batch entry, reasons, remarks, filters, summaries, edit, and delete.", new Date("2026-08-20T00:00:00"), "Done"],
  ["Breeder Reports", "Breeder report pages and report forms with farm, placement, cycle, and date-based selections.", new Date("2026-08-17T00:00:00"), "Done"],
  ["Validation & Data Safeguards", "Active placement/cycle checks, population and inventory validation, duplicate prevention, database policies, and transaction controls.", new Date("2026-08-20T00:00:00"), "Done"],
  ["Room Monitoring", "Breeder room-monitoring report and operational screen.", null, "Pending"],
  ["Machine Monitoring", "Breeder machine-monitoring report and operational screen.", null, "Pending"],
];

sheet.getRange("A1:D1").merge();
sheet.getRange("A1").values = [["BREEDER MODULE UPDATE TRACKER"]];
sheet.getRange("A2:D2").merge();
sheet.getRange("A2").values = [["Implementation status based on repository history through 24 Aug 2026"]];

sheet.getRange("A4").values = [["Total Activities"]];
sheet.getRange("B4").values = [["Done"]];
sheet.getRange("C4").values = [["Pending"]];
sheet.getRange("D4").values = [["Completion"]];
sheet.getRange("A5").formulas = [["=COUNTA(A7:A22)"]];
sheet.getRange("B5").formulas = [["=COUNTIF(D7:D22,\"Done\")"]];
sheet.getRange("C5").formulas = [["=COUNTIF(D7:D22,\"Pending\")"]];
sheet.getRange("D5").formulas = [["=IF(A5=0,0,B5/A5)"]];

sheet.getRange("A6:D6").values = [["Module", "Activities", "Date", "Status (Done/Pending)"]];
sheet.getRange("A7:D22").values = rows;

const table = sheet.tables.add("A6:D22", true, "BreederUpdateTable");
table.style = "TableStyleMedium2";
table.showFilterButton = true;
table.showBandedRows = true;

sheet.getRange("D7:D50").dataValidation = {
  rule: { type: "list", values: ["Done", "Pending"] },
};
sheet.getRange("D7:D22").conditionalFormats.add("containsText", {
  text: "Done",
  format: { fill: "#DCFCE7", font: { color: "#166534", bold: true } },
});
sheet.getRange("D7:D22").conditionalFormats.add("containsText", {
  text: "Pending",
  format: { fill: "#FEF3C7", font: { color: "#92400E", bold: true } },
});

sheet.getRange("A1:D1").format = {
  fill: "#14532D",
  font: { bold: true, color: "#FFFFFF", size: 18 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
sheet.getRange("A1:D1").format.rowHeight = 34;
sheet.getRange("A2:D2").format = {
  fill: "#DCFCE7",
  font: { italic: true, color: "#365314", size: 10 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
sheet.getRange("A2:D2").format.rowHeight = 24;

sheet.getRange("A4:D4").format = {
  fill: "#E2E8F0",
  font: { bold: true, color: "#334155" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: { preset: "outside", style: "thin", color: "#CBD5E1" },
};
sheet.getRange("A5:D5").format = {
  fill: "#F8FAFC",
  font: { bold: true, color: "#0F172A", size: 14 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: { preset: "outside", style: "thin", color: "#CBD5E1" },
};
sheet.getRange("A4:D5").format.rowHeight = 24;
sheet.getRange("A5:C5").format.numberFormat = "#,##0";
sheet.getRange("D5").format.numberFormat = "0%";

sheet.getRange("A6:D6").format = {
  fill: "#166534",
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
sheet.getRange("A6:D6").format.rowHeight = 27;
sheet.getRange("A7:A22").format = { font: { bold: true, color: "#1F2937" }, verticalAlignment: "top" };
sheet.getRange("B7:B22").format = { wrapText: true, verticalAlignment: "top" };
sheet.getRange("C7:C22").format = { numberFormat: "mmm d, yyyy", horizontalAlignment: "center", verticalAlignment: "top" };
sheet.getRange("D7:D22").format = { horizontalAlignment: "center", verticalAlignment: "top" };
sheet.getRange("A7:D22").format.rowHeight = 42;

sheet.getRange("A1:A22").format.columnWidth = 26;
sheet.getRange("B1:B22").format.columnWidth = 78;
sheet.getRange("C1:C22").format.columnWidth = 17;
sheet.getRange("D1:D22").format.columnWidth = 23;
sheet.freezePanes.freezeRows(6);

const preview = await workbook.render({
  sheetName: "Breeder Updates",
  range: "A1:D22",
  scale: 1.4,
  format: "png",
});
await fs.writeFile(`${outputDir}/preview.png`, new Uint8Array(await preview.arrayBuffer()));

const check = await workbook.inspect({
  kind: "table",
  range: "Breeder Updates!A1:D22",
  include: "values,formulas",
  tableMaxRows: 22,
  tableMaxCols: 4,
});
console.log(check.ndjson);
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/Breeder_Module_Update_Tracker.xlsx`);
