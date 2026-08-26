import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = new URL(".", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
const workbook = Workbook.create();
const summary = workbook.worksheets.add("KPI Summary");
const details = workbook.worksheets.add("KPI Details");

const navy = "#17365D";
const blue = "#2F75B5";
const paleBlue = "#D9EAF7";
const paleGreen = "#E2F0D9";
const paleGold = "#FFF2CC";
const lightGray = "#F3F6F9";
const midGray = "#D9E2F3";
const darkText = "#1F2937";
const white = "#FFFFFF";

for (const sheet of [summary, details]) {
  sheet.showGridLines = false;
}

// ---------------- KPI SUMMARY ----------------
summary.getRange("A1:H2").merge();
summary.getRange("A1").values = [["2026 INDIVIDUAL PERFORMANCE KPI"]];
summary.getRange("A1:H2").format = {
  fill: navy,
  font: { name: "Aptos Display", size: 20, bold: true, color: white },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
summary.getRange("A3:H3").merge();
summary.getRange("A3").values = [["Breeder System Development and Assigned Hatchery Modules"]];
summary.getRange("A3:H3").format = {
  fill: blue,
  font: { name: "Aptos", size: 11, italic: true, color: white },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};

summary.getRange("A5:B7").values = [
  ["Employee Name", ""],
  ["Evaluation Period", "2026"],
  ["Primary Assignment", "Breeder System and selected Hatchery modules"],
];
summary.getRange("A5:A7").format = {
  fill: paleBlue,
  font: { bold: true, color: navy },
  verticalAlignment: "center",
};
summary.getRange("B5:H5").merge();
summary.getRange("B6:H6").merge();
summary.getRange("B7:H7").merge();
summary.getRange("B5:H7").format = {
  fill: "#FFFFFF",
  borders: { preset: "outside", style: "thin", color: "#B4C6E7" },
  verticalAlignment: "center",
};

summary.getRange("A9:H9").values = [[
  "No.", "KPI Title", "Weight", "Primary Scope", "Status", "Actual Score", "Weighted Score", "Manager Remarks"
]];
summary.getRange("A9:H9").format = {
  fill: navy,
  font: { bold: true, color: white },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: "#FFFFFF" },
};

summary.getRange("A10:F13").values = [
  [1, "Complete and Deploy Assigned Breeder System Modules", 0.45, "Breeder", "Not Started", null],
  [2, "Complete Assigned Hatchery Modules and Breeder Integration", 0.25, "Hatchery / Integration", "Not Started", null],
  [3, "Maintain Application Quality, Documentation, and System Stability", 0.20, "Engineering Quality / Support", "Not Started", null],
  [4, "Strengthen Technical Leadership and Knowledge Sharing", 0.10, "Team Development", "Not Started", null],
];
summary.getRange("G10:G13").formulas = [
  ["=IF(F10=\"\",\"\",C10*F10)"],
  ["=IF(F11=\"\",\"\",C11*F11)"],
  ["=IF(F12=\"\",\"\",C12*F12)"],
  ["=IF(F13=\"\",\"\",C13*F13)"],
];
summary.getRange("H10:H13").values = [[""], [""], [""], [""]];
summary.getRange("A10:H13").format = {
  borders: {
    insideHorizontal: { style: "thin", color: "#D9E2F3" },
    bottom: { style: "thin", color: "#D9E2F3" },
  },
  verticalAlignment: "center",
  wrapText: true,
};
summary.getRange("A10:H10").format.fill = "#FFFFFF";
summary.getRange("A11:H11").format.fill = lightGray;
summary.getRange("A12:H12").format.fill = "#FFFFFF";
summary.getRange("A13:H13").format.fill = lightGray;
summary.getRange("A14:B14").merge();
summary.getRange("A14").values = [["TOTAL"]];
summary.getRange("C14").formulas = [["=SUM(C10:C13)"]];
summary.getRange("D14:F14").merge();
summary.getRange("D14").values = [["Overall Weighted Score"]];
summary.getRange("G14").formulas = [["=SUM(G10:G13)"]];
summary.getRange("H14").values = [[""]];
summary.getRange("A14:H14").format = {
  fill: paleGreen,
  font: { bold: true, color: navy },
  verticalAlignment: "center",
  borders: { preset: "outside", style: "medium", color: navy },
};
summary.getRange("A14:B14").format.horizontalAlignment = "right";
summary.getRange("D14:F14").format.horizontalAlignment = "right";

summary.getRange("C10:C14").format.numberFormat = "0%";
summary.getRange("F10:G14").format.numberFormat = "0.0";
summary.getRange("C10:C14").format.horizontalAlignment = "center";
summary.getRange("A10:A13").format.horizontalAlignment = "center";
summary.getRange("E10:E13").format.horizontalAlignment = "center";
summary.getRange("F10:G14").format.horizontalAlignment = "center";
summary.getRange("E10:E13").dataValidation = {
  rule: { type: "list", values: ["Not Started", "In Progress", "Completed", "On Hold"] },
};
summary.getRange("F10:F13").dataValidation = {
  rule: { type: "decimal", operator: "between", formula1: 0, formula2: 100 },
};
summary.getRange("E10:E13").conditionalFormats.add("containsText", {
  text: "Completed", format: { fill: "#C6EFCE", font: { color: "#006100", bold: true } },
});
summary.getRange("E10:E13").conditionalFormats.add("containsText", {
  text: "In Progress", format: { fill: "#FFF2CC", font: { color: "#9C6500", bold: true } },
});
summary.getRange("E10:E13").conditionalFormats.add("containsText", {
  text: "On Hold", format: { fill: "#F4CCCC", font: { color: "#9C0006", bold: true } },
});

summary.getRange("A16:H16").merge();
summary.getRange("A16").values = [["Scoring note: Enter a score from 0 to 100 in the Actual Score column. Weighted Score is calculated automatically."]];
summary.getRange("A16:H16").format = {
  fill: paleGold,
  font: { italic: true, color: "#7F6000" },
  wrapText: true,
  verticalAlignment: "center",
  borders: { preset: "outside", style: "thin", color: "#D6B656" },
};

summary.freezePanes.freezeRows(9);
summary.getRange("A1:H16").format.rowHeight = 24;
summary.getRange("A1:H2").format.rowHeight = 34;
summary.getRange("A9:H9").format.rowHeight = 36;
summary.getRange("A10:H13").format.rowHeight = 52;
summary.getRange("A16:H16").format.rowHeight = 32;
summary.getRange("A:A").format.columnWidth = 17;
summary.getRange("B:B").format.columnWidth = 38;
summary.getRange("C:C").format.columnWidth = 11;
summary.getRange("D:D").format.columnWidth = 24;
summary.getRange("E:E").format.columnWidth = 16;
summary.getRange("F:G").format.columnWidth = 15;
summary.getRange("H:H").format.columnWidth = 28;

// ---------------- KPI DETAILS ----------------
details.getRange("A1:H2").merge();
details.getRange("A1").values = [["2026 KPI DETAILS AND SUCCESS MEASURES"]];
details.getRange("A1:H2").format = {
  fill: navy,
  font: { name: "Aptos Display", size: 19, bold: true, color: white },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
details.getRange("A3:H3").merge();
details.getRange("A3").values = [["Individual Contributor — Breeder System and Assigned Hatchery Modules"]];
details.getRange("A3:H3").format = {
  fill: blue,
  font: { italic: true, color: white },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};

details.getRange("A5:H5").values = [[
  "No.", "KPI Title", "Weight", "Objective / Description", "Measurable Success Indicators", "Project Reference / Scope", "Evidence / Deliverables", "Remarks"
]];
details.getRange("A5:H5").format = {
  fill: navy,
  font: { bold: true, color: white },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: white },
};

const detailRows = [
  [
    1,
    "Complete and Deploy Assigned Breeder System Modules",
    "='KPI Summary'!C10",
    "Successfully develop, integrate, test, and deploy the assigned Breeder System modules according to approved business requirements and agreed project timelines.",
    "• Complete at least 95% of assigned milestones within agreed timelines.\n• Complete functional testing and UAT for all critical workflows.\n• Obtain acceptance from assigned business users or process owners.\n• Resolve all critical release-related defects before production rollout.\n• Provide technical documentation, database scripts, deployment instructions, and user guides.",
    "Placement; growing; vaccination; medication; egg laying; breeder transfers; dispatch; cleanup; breeder reporting.",
    "Approved requirements; milestone tracker; test evidence; UAT sign-off; release notes; deployment scripts; user and technical guides.",
    "",
  ],
  [
    2,
    "Complete Assigned Hatchery Modules and Breeder Integration",
    "='KPI Summary'!C11",
    "Develop and deliver assigned Hatchery modules while ensuring accurate and reliable integration with the Breeder System.",
    "• Complete at least 95% of assigned Hatchery tasks within agreed timelines.\n• Ensure egg quantities, flock references, document references, and statuses flow correctly from Breeder to Hatchery.\n• Complete end-to-end integration testing.\n• Resolve all critical UAT findings before deployment.\n• Obtain business-owner acceptance for completed modules.",
    "Assigned portions of egg storage; egg transfer; pre-warming; egg setting; egg hatching; chick pullout; grading; classification; dispatch.",
    "Task tracker; integration test results; reconciliation records; UAT sign-off; release notes; updated documentation.",
    "",
  ],
  [
    3,
    "Maintain Application Quality, Documentation, and System Stability",
    "='KPI Summary'!C12",
    "Produce secure, maintainable, and reliable applications through proper testing, documentation, code-quality practices, and effective issue resolution.",
    "• Ensure production releases pass build, linting, functional testing, and UAT.\n• Provide test evidence for each critical workflow affected by a release.\n• Document complex business rules, database changes, APIs, integrations, and deployment procedures.\n• Resolve at least 95% of assigned critical/high-priority issues within the agreed SLA.\n• Complete at least two performance, security, architecture, or maintainability improvements.",
    "Breeder and assigned Hatchery work; Broiler support only when assigned; Next.js, React, TypeScript, Supabase, database migrations, reports, and permissions.",
    "Build/lint results; test records; issue and RCA log; code-review evidence; technical documentation; before-and-after improvement measurements.",
    "",
  ],
  [
    4,
    "Strengthen Technical Leadership and Knowledge Sharing",
    "='KPI Summary'!C13",
    "Improve technical leadership by contributing to design discussions, mentoring teammates, and sharing reusable development knowledge and best practices.",
    "• Conduct at least one mentoring or knowledge-sharing session every two months.\n• Participate actively in technical design and code-review discussions.\n• Assist at least one teammate or junior developer.\n• Create at least four reusable technical references.\n• Share lessons learned from significant development or production issues.",
    "Technical design, code review, troubleshooting, deployment practices, system architecture, and team development.",
    "Session records; presentation materials; code-review links; mentoring notes; troubleshooting guides; coding standards; deployment checklists.",
    "",
  ],
];

for (let i = 0; i < detailRows.length; i++) {
  const row = 6 + i;
  const values = detailRows[i];
  details.getRange(`A${row}:B${row}`).values = [[values[0], values[1]]];
  details.getRange(`C${row}`).formulas = [[values[2]]];
  details.getRange(`D${row}:H${row}`).values = [[values[3], values[4], values[5], values[6], values[7]]];
}

details.getRange("A6:H9").format = {
  wrapText: true,
  verticalAlignment: "top",
  borders: {
    insideHorizontal: { style: "thin", color: "#C9D5E5" },
    bottom: { style: "thin", color: "#C9D5E5" },
  },
};
details.getRange("A6:H6").format.fill = "#FFFFFF";
details.getRange("A7:H7").format.fill = lightGray;
details.getRange("A8:H8").format.fill = "#FFFFFF";
details.getRange("A9:H9").format.fill = lightGray;
details.getRange("A6:A9").format.horizontalAlignment = "center";
details.getRange("C6:C9").format.horizontalAlignment = "center";
details.getRange("C6:C9").format.numberFormat = "0%";
details.getRange("B6:B9").format.font = { bold: true, color: navy };

details.getRange("A11:B11").merge();
details.getRange("A11").values = [["TOTAL KPI WEIGHT"]];
details.getRange("C11").formulas = [["=SUM(C6:C9)"]];
details.getRange("D11:H11").merge();
details.getRange("D11").values = [["Weights are linked to the KPI Summary sheet and total automatically."]];
details.getRange("A11:H11").format = {
  fill: paleGreen,
  font: { bold: true, color: navy },
  verticalAlignment: "center",
  borders: { preset: "outside", style: "medium", color: navy },
};
details.getRange("C11").format.numberFormat = "0%";
details.getRange("C11").format.horizontalAlignment = "center";

details.freezePanes.freezeRows(5);
details.getRange("A1:H2").format.rowHeight = 34;
details.getRange("A5:H5").format.rowHeight = 48;
details.getRange("A6:H9").format.rowHeight = 150;
details.getRange("A11:H11").format.rowHeight = 30;
details.getRange("A:A").format.columnWidth = 6;
details.getRange("B:B").format.columnWidth = 34;
details.getRange("C:C").format.columnWidth = 10;
details.getRange("D:D").format.columnWidth = 36;
details.getRange("E:E").format.columnWidth = 52;
details.getRange("F:F").format.columnWidth = 38;
details.getRange("G:G").format.columnWidth = 40;
details.getRange("H:H").format.columnWidth = 24;

const summaryCheck = await workbook.inspect({
  kind: "table",
  range: "KPI Summary!A9:H16",
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 8,
});
console.log(summaryCheck.ndjson);

const detailsCheck = await workbook.inspect({
  kind: "table",
  range: "KPI Details!A5:H11",
  include: "values,formulas",
  tableMaxRows: 10,
  tableMaxCols: 8,
  tableMaxCellChars: 120,
});
console.log(detailsCheck.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

for (const [sheetName, fileName] of [["KPI Summary", "summary-preview.png"], ["KPI Details", "details-preview.png"]]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1.2, format: "png" });
  await fs.writeFile(new URL(fileName, import.meta.url), new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(new URL("2026_Individual_KPI_Breeder_Hatchery.xlsx", import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
