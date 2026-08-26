import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const here = new URL(".", import.meta.url);
const toPath = (url) => url.pathname.replace(/^\/(.:)/, "$1");
const sourcePath = toPath(new URL("2026_Individual_KPI_Breeder_Hatchery.xlsx", here));
const outputPath = toPath(new URL("2026_Individual_KPI_SMART.xlsx", here));

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(sourcePath));
const summary = workbook.worksheets.getItem("KPI Summary");
const details = workbook.worksheets.getItem("KPI Details");

const navy = "#17365D";
const blue = "#2F75B5";
const paleGreen = "#E2F0D9";
const paleGold = "#FFF2CC";
const lightGray = "#F3F6F9";
const white = "#FFFFFF";

// Revise summary from four goals to the requested SMART three-goal structure.
summary.getRange("A14:B14").unmerge();
summary.getRange("D14:F14").unmerge();
summary.getRange("A16:H16").unmerge();
summary.getRange("A9:H16").clear({ applyTo: "all" });

summary.getRange("A3:H3").values = [["SMART KPI — Assigned FMS Breeder and Hatchery Modules"]];
summary.getRange("A9:H9").values = [[
  "No.", "KPI Title", "Weight", "Primary Scope", "Status", "Actual Score", "Weighted Score", "Manager Remarks"
]];
summary.getRange("A9:H9").format = {
  fill: navy,
  font: { bold: true, color: white },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: white },
};

summary.getRange("A10:F12").values = [
  [1, "Complete and Deploy Assigned FMS Modules and Integration", 0.70, "Breeder + Assigned Hatchery", "Not Started", null],
  [2, "Maintain Application Quality, Documentation, and System Stability", 0.20, "Engineering Quality / Support", "Not Started", null],
  [3, "Strengthen Technical Leadership and Knowledge Sharing", 0.10, "Team Development", "Not Started", null],
];
summary.getRange("G10:G12").formulas = [
  ["=IF(F10=\"\",\"\",C10*F10)"],
  ["=IF(F11=\"\",\"\",C11*F11)"],
  ["=IF(F12=\"\",\"\",C12*F12)"],
];
summary.getRange("H10:H12").values = [[""], [""], [""]];
summary.getRange("A10:H12").format = {
  wrapText: true,
  verticalAlignment: "center",
  borders: {
    insideHorizontal: { style: "thin", color: "#D9E2F3" },
    bottom: { style: "thin", color: "#D9E2F3" },
  },
};
summary.getRange("A10:H10").format.fill = white;
summary.getRange("A11:H11").format.fill = lightGray;
summary.getRange("A12:H12").format.fill = white;
summary.getRange("A10:A12").format.horizontalAlignment = "center";
summary.getRange("C10:C13").format.horizontalAlignment = "center";
summary.getRange("E10:G13").format.horizontalAlignment = "center";
summary.getRange("C10:C13").format.numberFormat = "0%";
summary.getRange("F10:G13").format.numberFormat = "0.0";

summary.getRange("A13:B13").merge();
summary.getRange("A13").values = [["TOTAL"]];
summary.getRange("C13").formulas = [["=SUM(C10:C12)"]];
summary.getRange("D13:F13").merge();
summary.getRange("D13").values = [["Overall Weighted Score"]];
summary.getRange("G13").formulas = [["=SUM(G10:G12)"]];
summary.getRange("H13").values = [[""]];
summary.getRange("A13:H13").format = {
  fill: paleGreen,
  font: { bold: true, color: navy },
  verticalAlignment: "center",
  borders: { preset: "outside", style: "medium", color: navy },
};
summary.getRange("A13:B13").format.horizontalAlignment = "right";
summary.getRange("D13:F13").format.horizontalAlignment = "right";

summary.getRange("A15:H15").merge();
summary.getRange("A15").values = [["SMART framework: targets are Specific, Measurable, Achievable, Relevant, and Time-bound. Enter a score from 0 to 100; weighted results calculate automatically."]];
summary.getRange("A15:H15").format = {
  fill: paleGold,
  font: { italic: true, color: "#7F6000" },
  wrapText: true,
  verticalAlignment: "center",
  borders: { preset: "outside", style: "thin", color: "#D6B656" },
};

summary.getRange("E10:E12").dataValidation = {
  rule: { type: "list", values: ["Not Started", "In Progress", "Completed", "On Hold"] },
};
summary.getRange("F10:F12").dataValidation = {
  rule: { type: "decimal", operator: "between", formula1: 0, formula2: 100 },
};
summary.getRange("E10:E12").conditionalFormats.deleteAll();
summary.getRange("E10:E12").conditionalFormats.add("containsText", {
  text: "Completed", format: { fill: "#C6EFCE", font: { color: "#006100", bold: true } },
});
summary.getRange("E10:E12").conditionalFormats.add("containsText", {
  text: "In Progress", format: { fill: "#FFF2CC", font: { color: "#9C6500", bold: true } },
});
summary.getRange("E10:E12").conditionalFormats.add("containsText", {
  text: "On Hold", format: { fill: "#F4CCCC", font: { color: "#9C0006", bold: true } },
});
summary.getRange("A9:H9").format.rowHeight = 36;
summary.getRange("A10:H12").format.rowHeight = 58;
summary.getRange("A13:H13").format.rowHeight = 28;
summary.getRange("A15:H15").format.rowHeight = 34;
summary.getRange("B:B").format.columnWidth = 43;
summary.getRange("D:D").format.columnWidth = 27;

// Replace the details table with an explicit SMART matrix.
details.getRange("A11:B11").unmerge();
details.getRange("D11:H11").unmerge();
details.getRange("A5:H11").clear({ applyTo: "all" });
details.getRange("A1:H2").values = [["2026 SMART KPI DETAILS"]];
details.getRange("A3:H3").values = [["Specific • Measurable • Achievable • Relevant • Time-bound"]];

details.getRange("A5:H5").values = [[
  "No.", "KPI Title", "Weight", "Specific", "Measurable", "Achievable", "Relevant", "Time-bound & Evidence"
]];
details.getRange("A5:H5").format = {
  fill: navy,
  font: { bold: true, color: white },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: white },
};

const smartRows = [
  {
    no: 1,
    title: "Complete and Deploy Assigned FMS Modules and Integration",
    weightFormula: "='KPI Summary'!C10",
    specific: "Complete the development, integration, testing, documentation, and production deployment of all assigned Breeder System modules and selected Hatchery modules within the approved scope.",
    measurable: "• Deliver at least 95% of assigned milestones on time.\n• Test 100% of critical workflows and complete UAT.\n• Have zero unresolved critical defects at go-live.\n• Provide release and technical documentation for 100% of deployed modules.",
    achievable: "Use agreed milestone plans, weekly progress tracking, code reviews, test checklists, and regular coordination with process owners. Escalate requirement or dependency risks early.",
    relevant: "Directly supports successful FMS implementation, accurate Breeder-to-Hatchery transactions, operational efficiency, system adoption, and the employee's primary project assignment.",
    time: "Complete each module by its approved milestone and finish the assigned 2026 scope by 31 December 2026. Complete UAT before each release and close critical defects before go-live. Evidence: milestone tracker, UAT sign-off, release notes, deployment scripts, and user/technical guides.",
  },
  {
    no: 2,
    title: "Maintain Application Quality, Documentation, and System Stability",
    weightFormula: "='KPI Summary'!C11",
    specific: "Maintain secure, stable, and supportable FMS applications by applying consistent testing, documentation, code-quality, issue-resolution, and root-cause-analysis practices.",
    measurable: "• Ensure 100% of releases pass build, linting, functional testing, and required UAT.\n• Resolve at least 95% of assigned critical/high-priority issues within SLA.\n• Document 100% of significant releases and database changes.\n• Deliver at least two performance, security, architecture, or maintainability improvements.",
    achievable: "Apply a release checklist, maintain an issue/RCA log, perform impact analysis and peer review, reuse project standards, and prioritize fixes based on severity and business impact.",
    relevant: "Protects business continuity, reduces recurring defects, improves maintainability, and supports reliable Breeder, Hatchery, and assigned Broiler workflows.",
    time: "Complete testing and documentation before every production release; resolve incidents within the agreed SLA; issue RCA for critical or recurring problems within two business days after stabilization; complete two improvements by 31 December 2026. Evidence: build/lint results, tests, issue log, RCA, and before/after measures.",
  },
  {
    no: 3,
    title: "Strengthen Technical Leadership and Knowledge Sharing",
    weightFormula: "='KPI Summary'!C12",
    specific: "Contribute to technical design and code reviews, mentor at least one teammate, and share reusable FMS development, troubleshooting, and deployment practices.",
    measurable: "• Conduct at least one mentoring or knowledge-sharing session every two months (minimum six in 2026).\n• Mentor at least one teammate.\n• Produce at least four reusable technical references.\n• Participate in design or code review for major assigned enhancements.",
    achievable: "Schedule short knowledge sessions, use current project work as practical examples, document lessons learned while issues are resolved, and include teammates in reviews and troubleshooting.",
    relevant: "Addresses the identified development area in technical leadership, reduces reliance on individual knowledge, and improves consistency and maintainability across the team.",
    time: "Complete at least one session every two months, review progress quarterly, and finish six sessions plus four technical references by 31 December 2026. Evidence: session records, materials, code-review links, mentoring notes, guides, and checklists.",
  },
];

for (let i = 0; i < smartRows.length; i++) {
  const row = 6 + i;
  const item = smartRows[i];
  details.getRange(`A${row}:B${row}`).values = [[item.no, item.title]];
  details.getRange(`C${row}`).formulas = [[item.weightFormula]];
  details.getRange(`D${row}:H${row}`).values = [[item.specific, item.measurable, item.achievable, item.relevant, item.time]];
}

details.getRange("A6:H8").format = {
  wrapText: true,
  verticalAlignment: "top",
  borders: {
    insideHorizontal: { style: "thin", color: "#C9D5E5" },
    bottom: { style: "thin", color: "#C9D5E5" },
  },
};
details.getRange("A6:H6").format.fill = white;
details.getRange("A7:H7").format.fill = lightGray;
details.getRange("A8:H8").format.fill = white;
details.getRange("A6:A8").format.horizontalAlignment = "center";
details.getRange("C6:C8").format.horizontalAlignment = "center";
details.getRange("C6:C8").format.numberFormat = "0%";
details.getRange("B6:B8").format.font = { bold: true, color: navy };

details.getRange("A10:B10").merge();
details.getRange("A10").values = [["TOTAL KPI WEIGHT"]];
details.getRange("C10").formulas = [["=SUM(C6:C8)"]];
details.getRange("D10:H10").merge();
details.getRange("D10").values = [["SMART goals are linked to the KPI Summary and total automatically."]];
details.getRange("A10:H10").format = {
  fill: paleGreen,
  font: { bold: true, color: navy },
  verticalAlignment: "center",
  borders: { preset: "outside", style: "medium", color: navy },
};
details.getRange("C10").format.numberFormat = "0%";
details.getRange("C10").format.horizontalAlignment = "center";

details.getRange("A5:H5").format.rowHeight = 48;
details.getRange("A6:H8").format.rowHeight = 205;
details.getRange("A10:H10").format.rowHeight = 30;
details.getRange("A:A").format.columnWidth = 6;
details.getRange("B:B").format.columnWidth = 35;
details.getRange("C:C").format.columnWidth = 10;
details.getRange("D:D").format.columnWidth = 36;
details.getRange("E:E").format.columnWidth = 44;
details.getRange("F:F").format.columnWidth = 36;
details.getRange("G:G").format.columnWidth = 38;
details.getRange("H:H").format.columnWidth = 48;

const summaryCheck = await workbook.inspect({
  kind: "table", range: "KPI Summary!A9:H15", include: "values,formulas", tableMaxRows: 10, tableMaxCols: 8,
});
console.log(summaryCheck.ndjson);
const detailCheck = await workbook.inspect({
  kind: "table", range: "KPI Details!A5:H10", include: "values,formulas", tableMaxRows: 8, tableMaxCols: 8, tableMaxCellChars: 100,
});
console.log(detailCheck.ndjson);
const errors = await workbook.inspect({
  kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan",
});
console.log(errors.ndjson);

for (const [sheetName, fileName] of [["KPI Summary", "smart-summary-preview.png"], ["KPI Details", "smart-details-preview.png"]]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1.15, format: "png" });
  await fs.writeFile(toPath(new URL(fileName, here)), new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
