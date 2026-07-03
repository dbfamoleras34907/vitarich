import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const outputPath = join(process.cwd(), "public", "generated", "flock-card-daily.xls");
const ages = Array.from({ length: 40 }, (_, index) => index);

const topHeaders = [
  { label: "Mortality", span: 3 },
  { label: "Thinning", span: 2 },
  { label: "Total", span: 2 },
  { label: "Feed Intake", span: 4 },
  { label: "Water Intake", span: 2 },
  { label: "Body weight", span: 2 },
  { label: "Climate", span: 5 },
  { label: "Skin color", span: 3 },
  { label: "", span: 4 },
];

const middleHeaders = [
  { label: "Deaths", span: 3 },
  { label: "Other", span: 2 },
  { label: "Total", rowSpan: 2 },
  { label: "Cumulative", rowSpan: 2 },
  { label: "Daily kg/Flock", rowSpan: 2 },
  { label: "Daily per Bird", rowSpan: 2 },
  { label: "Guideline", rowSpan: 2 },
  { label: "Feeds Batch", rowSpan: 2 },
  { label: "Daily L/Flock", rowSpan: 2 },
  { label: "Daily per Bird", rowSpan: 2 },
  { label: "", span: 2 },
  { label: "Temp.", span: 2 },
  { label: "Humidity", span: 2 },
  { label: "NH3", span: 1 },
  { label: "", span: 3 },
  { label: "", span: 4 },
];

const bottomHeaders = [
  "AM",
  "PM",
  "Total",
  "AM",
  "PM",
  "Weight g",
  "Guideline g",
  "Min C",
  "Max C",
  "Min %",
  "Max %",
  "Max ppm",
  "B (yellow)",
  "A (red)",
  "L (luminosity)",
];

const dataColumnCount = topHeaders.reduce((total, header) => total + header.span, 0);
const firstDataRow = 7;
const lastDataRow = firstDataRow + ages.length - 1;
const footerRow = lastDataRow + 1;

function columnName(index) {
  let dividend = index + 1;
  let name = "";

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return name;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderHeaderCell({ label, span = 1, rowSpan = 1 }) {
  const colspan = span > 1 ? ` colspan="${span}"` : "";
  const rowspan = rowSpan > 1 ? ` rowspan="${rowSpan}"` : "";

  return `<th${colspan}${rowspan} class="header">${escapeHtml(label)}</th>`;
}

function renderInputCell() {
  return '<td class="input">&nbsp;</td>';
}

function renderFooterCell(columnIndex) {
  const column = columnName(columnIndex + 1);
  return `<td class="footer">=SUM(${column}${firstDataRow}:${column}${lastDataRow})</td>`;
}

const workbook = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <!--[if gte mso 9]><xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Flock Card Daily</x:Name>
          <x:WorksheetOptions>
            <x:FreezePanes/>
            <x:FrozenNoSplit/>
            <x:SplitHorizontal>6</x:SplitHorizontal>
            <x:TopRowBottomPane>6</x:TopRowBottomPane>
            <x:ActivePane>2</x:ActivePane>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml><![endif]-->
  <style>
    body { font-family: Arial, sans-serif; }
    table { border-collapse: collapse; }
    col.age { width: 90px; }
    col.data { width: 120px; }
    th, td {
      border: 1px solid #d9d6d0;
      height: 34px;
      padding: 4px 8px;
      text-align: center;
      vertical-align: middle;
      white-space: nowrap;
    }
    .title {
      border: 0;
      font-size: 24px;
      font-weight: 600;
      text-align: left;
    }
    .field-label {
      border: 0;
      color: #666666;
      font-size: 12px;
      text-align: left;
    }
    .field-value {
      border: 1px solid #bfbfbf;
      font-size: 18px;
      text-align: left;
    }
    .header {
      background: #f2f6fa;
      color: #2d2d2d;
      font-weight: 600;
    }
    .age {
      background: #ffffff;
      font-weight: 600;
    }
    .input { background: #ffffff; }
    .footer {
      background: #0f172a;
      color: #ffffff;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <table>
    <colgroup>
      <col class="age" />
      ${Array.from({ length: dataColumnCount }, () => '<col class="data" />').join("\n      ")}
    </colgroup>
    <tr>
      <td colspan="${dataColumnCount + 1}" class="title">Flock Card: Daily</td>
    </tr>
    <tr>
      <td colspan="3" class="field-label">Number of animals</td>
      ${Array.from({ length: dataColumnCount - 2 }, () => '<td class="field-label">&nbsp;</td>').join("")}
    </tr>
    <tr>
      <td colspan="3" class="field-value">21500</td>
      ${Array.from({ length: dataColumnCount - 2 }, () => '<td>&nbsp;</td>').join("")}
    </tr>
    <tr>
      <th rowspan="3" class="header">Age</th>
      ${topHeaders.map(renderHeaderCell).join("\n      ")}
    </tr>
    <tr>
      ${middleHeaders.map(renderHeaderCell).join("\n      ")}
    </tr>
    <tr>
      ${bottomHeaders.map((label) => renderHeaderCell({ label })).join("\n      ")}
      <th colspan="4" class="header">&nbsp;</th>
    </tr>
    ${ages
      .map(
        (age) => `<tr>
      <td class="age">${age}</td>
      ${Array.from({ length: dataColumnCount }, renderInputCell).join("\n      ")}
    </tr>`
      )
      .join("\n    ")}
    <tr>
      <td class="footer">Total</td>
      ${Array.from({ length: dataColumnCount }, (_, index) => renderFooterCell(index)).join("\n      ")}
    </tr>
  </table>
</body>
</html>
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, workbook, "utf8");

console.log(`Generated ${outputPath}`);
