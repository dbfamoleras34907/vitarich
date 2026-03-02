type PrintItem = {
  doc_batch_code: string;
  sku_name: string;
  classification?: string | null;
  uom?: string | null;
  qty: number;
};

type PrintPayload = {
  dr_no: string;
  doc_date: string; // YYYY-MM-DD
  farm_name: string;
  address?: string | null;
  from_name?: string | null;
  remarks?: string | null;
  items: PrintItem[];
};

function fmtDateMDY(ymd: string) {
  // 2026-02-27 -> 02/27/2026
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${m}/${d}/${y}`;
}

function escapeHtml(s: any) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function printTransferSlip(payload: PrintPayload) {
  const rows = (payload.items ?? []).map((it) => {
    // Template has: PROD CODE / DESCRIPTION / QUANTITY / UNIT
    // We'll use:
    // PROD CODE = doc_batch_code
    // DESCRIPTION = sku_name (you may append classification if you want)
    const desc = it.classification
      ? `${it.sku_name} (${it.classification})`
      : it.sku_name;
    return `
      <tr>
        <td>${escapeHtml(it.doc_batch_code)}</td>
        <td>${escapeHtml(desc)}</td>
        <td style="text-align:right;">${escapeHtml(it.qty)}</td>
        <td>${escapeHtml(it.uom ?? "")}</td>
      </tr>
    `;
  });

  // Keep at least ~8 empty rows like the template look
  const minRows = 8;
  while (rows.length < minRows) {
    rows.push(`
      <tr>
        <td>&nbsp;</td><td></td><td></td><td></td>
      </tr>
    `);
  }

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Transfer Slip - ${escapeHtml(payload.dr_no)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: Arial, Helvetica, sans-serif; color:#111; }
    .top { display:flex; justify-content:space-between; align-items:flex-start; }
    .brand { font-weight:700; font-size:22px; letter-spacing:0.5px; }
    .addr { font-size:12px; line-height:1.35; margin-top:6px; }
    .title { text-align:center; font-weight:700; font-size:18px; margin: 14px 0 10px; }
    .meta { display:flex; gap:24px; margin: 6px 0 10px; font-size:12px; }
    .line { display:inline-block; min-width:240px; border-bottom:1px solid #111; padding: 0 0 2px; }
    .block { margin: 10px 0; font-size:12px; }
    .label { display:inline-block; width:110px; }
    table { width:100%; border-collapse:collapse; margin-top:10px; font-size:12px; }
    thead th { border:1px solid #111; padding:6px 8px; text-align:left; }
    tbody td { border:1px solid #111; padding:6px 8px; vertical-align:top; }
    .note { font-size:11px; margin-top:10px; line-height:1.35; }
    .sign-wrap { display:grid; grid-template-columns: 1fr 1fr 1fr; gap:18px; margin-top:16px; font-size:12px; }
    .sign .nameLine { border-bottom:1px solid #111; height:18px; margin-top:18px; }
    .sign .sub { text-align:center; margin-top:4px; font-size:11px; }
    .copies { margin-top:10px; font-size:11px; }
    .bottom { display:flex; justify-content:space-between; gap:18px; margin-top:14px; font-size:12px; }
    .bottom .left, .bottom .right { width:50%; }
    .smallLine { display:inline-block; min-width:220px; border-bottom:1px solid #111; }
    .muted { color:#444; }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <div class="brand">VITARICH</div>
      <div class="addr">
        Address: Marilao-San Jose Road, Sta. Rosa 1, Marilao Bulacan<br/>
        Tel No.: 843-3033 Loc 129<br/>
        Fax No.: 843-3033 Loc 400<br/>
        VAT REG. TIN 000-234-398-000
      </div>
    </div>
  </div>

  <div class="title">TRANSFER SLIP</div>

  <div class="meta">
    <div>DOC NO. <span class="line">${escapeHtml(payload.dr_no)}</span></div>
    <div>DATE: <span class="line">${escapeHtml(fmtDateMDY(payload.doc_date))}</span></div>
  </div>

  <div class="block">
    <div><span class="label">DELIVERED TO:</span> <span class="line" style="min-width:420px;">${escapeHtml(payload.farm_name)}</span></div>
  </div>

  <div class="block">
    <div><span class="label">ADDRESS:</span> <span class="line" style="min-width:420px;">${escapeHtml(payload.address ?? "")}</span></div>
  </div>

  <div class="block" style="margin-top:16px;">
    <div><span class="label">FROM:</span> <span class="line" style="min-width:420px;">${escapeHtml(payload.from_name ?? "")}</span></div>
  </div>

  <div class="block muted">Transferred the following materials and supplies in good order and condition.</div>

  <table>
    <thead>
      <tr>
        <th style="width:32%;">PROD CODE</th>
        <th>DESCRIPTION</th>
        <th style="width:14%; text-align:right;">QUANTITY</th>
        <th style="width:12%;">UNIT</th>
      </tr>
    </thead>
    <tbody>
      ${rows.join("")}
    </tbody>
  </table>

  <div class="note">
    Note: Authorized courier shall be responsible for any loss or damage of the materials &amp; supplies while in transit &amp; such liability shall be extinguished only at the time that authorized transferee acknowledges receipt of the materials &amp; supplies on the same condition as specified above.
  </div>

  <div class="sign-wrap">
    <div class="sign">
      <div><b>ISSUED BY:</b></div>
      <div class="nameLine"></div>
      <div class="sub">(Transferor)</div>
      <div style="margin-top:8px;">DATE: <span class="smallLine"></span></div>
    </div>

    <div class="sign">
      <div><b>RECEIVED BY:</b></div>
      <div class="nameLine"></div>
      <div class="sub">(Transferee)</div>
      <div style="margin-top:8px;">DATE: <span class="smallLine"></span></div>
    </div>

    <div class="sign">
      <div><b>RECEIVED BY:</b></div>
      <div class="nameLine"></div>
      <div class="sub">(Authorized Courier)</div>
      <div style="margin-top:8px;">DATE: <span class="smallLine"></span></div>
    </div>
  </div>

  <div class="copies">
    Original - destination / transferee<br/>
    Pink - source / transferor<br/>
    Yellow - accounting<br/>
    Blue - extra copy
  </div>

  <div class="bottom">
    <div class="left">
      DOA: <span class="smallLine"></span><br/><br/>
      REJECT: <span class="smallLine"></span><br/><br/>
      SHORT COUNT: <span class="smallLine"></span>
    </div>
    <div class="right">
      REMARKS: <span class="smallLine" style="min-width:260px;"></span>
    </div>
  </div>

  <script>
    window.onload = () => {
      window.focus();
      window.print();
      // window.close(); // enable if you want auto-close after print
    };
  </script>
</body>
</html>
`;

  const w = window.open(
    "",
    "_blank",
    "noopener,noreferrer,width=900,height=650",
  );
  if (!w) {
    alert("Popup blocked. Please allow popups for printing.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
