import fs from 'node:fs';
import path from 'node:path';
import {
  Presentation,
  PresentationFile,
  row as rawRow,
  column as rawColumn,
  grid as rawGrid,
  text,
  image,
  rule as rawRule,
  fill,
  fixed,
  fr,
} from '@oai/artifact-tool';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSET = path.join(ROOT, 'scratch', 'assets', 'vitarich-ceo-update').replaceAll('\\', '/');
const OUT = path.join(ROOT, 'output');
const RENDER = path.join(ROOT, 'rendered');
const VERIFY = path.join(ROOT, 'verified-render');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(RENDER, { recursive: true });
fs.mkdirSync(VERIFY, { recursive: true });

const C = {
  green: '#0B5B3C',
  deep: '#063B2B',
  lime: '#8EBF42',
  gold: '#D6A629',
  cream: '#F6F2E7',
  white: '#FFFFFF',
  ink: '#18332A',
  muted: '#66736D',
  pale: '#E8F0E9',
  line: '#C8D4CD',
  amber: '#E8A92D',
  red: '#B94A3D',
};

const W = 1920;
const H = 1080;
const PAD = 92;
const assetDataCache = new Map();

function assetData(fileName) {
  if (!assetDataCache.has(fileName)) {
    const bytes = fs.readFileSync(path.join(ASSET, fileName));
    assetDataCache.set(fileName, `data:image/png;base64,${bytes.toString('base64')}`);
  }
  return assetDataCache.get(fileName);
}

function variadicLayout(factory, args) {
  if (args.length === 2 && Array.isArray(args[1])) return factory(args[0], args[1]);
  const props = args.at(-1);
  return factory(props, args.slice(0, -1));
}

function row(...args) { return variadicLayout(rawRow, args); }
function column(...args) { return variadicLayout(rawColumn, args); }
function grid(...args) { return variadicLayout(rawGrid, args); }
function rule({ color, thickness, length, ...rest }) {
  return rawRule({ ...rest, width: fixed(length), stroke: color, weight: thickness });
}

function t(value, size, color = C.ink, extra = {}) {
  return text(value, {
    width: fill,
    height: fixed(Math.max(size * 1.34, 36)),
    style: { fontSize: size, color, fontFamily: 'Segoe UI', ...extra },
  });
}

function kicker(value) {
  return text(value.toUpperCase(), {
    width: fill,
    height: fixed(32),
    style: { fontSize: 15, bold: true, color: C.gold, letterSpacing: 2.2, fontFamily: 'Segoe UI' },
  });
}

function title(value, size = 46) {
  return text(value, {
    width: fill,
    height: fixed(size * 2.15),
    style: { fontSize: size, bold: true, color: C.deep, fontFamily: 'Bahnschrift' },
  });
}

function logo(width = 176) {
  return image({ dataUrl: assetData('vitarich-logo.png'), width: fixed(width), height: fixed(52), fit: 'contain', alt: 'Vitarich logo' });
}

function header(label, heading, page) {
  return row(
    column(kicker(label), title(heading), { width: fill, height: fixed(138), gap: 5 }),
    column(logo(), text(String(page).padStart(2, '0'), { width: fill, height: fixed(32), style: { fontSize: 16, bold: true, color: C.muted, textAlign: 'right' } }), { width: fixed(190), height: fixed(92), gap: 4 }),
    { width: fill, height: fixed(138), gap: 20, alignItems: 'start' },
  );
}

function footer() {
  return row(
    rule({ color: C.line, thickness: 1, length: 1320 }),
    text('VITA FMS • CEO PROJECT UPDATE • 25 AUG 2026', { width: fixed(420), height: fixed(20), style: { fontSize: 11, bold: true, color: C.muted, textAlign: 'right', letterSpacing: 1.1 } }),
    { width: fill, height: fixed(20), alignItems: 'center', gap: 22 },
  );
}

function pill(value, color = C.green) {
  return text(value, {
    width: fill,
    height: fixed(44),
    style: { fontSize: 18, bold: true, color, textAlign: 'center', verticalAlign: 'middle' },
  });
}

function openMetric(value, label, accent = C.green) {
  return column(
    text(value, { width: fill, height: fixed(76), style: { fontSize: 56, bold: true, color: accent, fontFamily: 'Bahnschrift' } }),
    text(label, { width: fill, height: fixed(56), style: { fontSize: 18, bold: true, color: C.ink } }),
    { width: fill, height: fixed(144), gap: 5 },
  );
}

function node(label, sub = '', color = C.green) {
  return column(
    text(label, { width: fill, height: fixed(42), style: { fontSize: 21, bold: true, color, textAlign: 'center', verticalAlign: 'middle' } }),
    sub ? text(sub, { width: fill, height: fixed(54), style: { fontSize: 14, color: C.muted, textAlign: 'center' } }) : text('', { width: fill, height: fixed(8), style: { fontSize: 1 } }),
    { width: fill, height: fixed(sub ? 112 : 58), gap: 8 },
  );
}

function arrow() {
  return text('→', { width: fixed(48), height: fixed(46), style: { fontSize: 32, bold: true, color: C.gold, textAlign: 'center' } });
}

function barRow(label, value, length, color = C.green) {
  return row(
    text(label, { width: fixed(110), height: fixed(44), style: { fontSize: 20, bold: true, color: C.deep } }),
    rawRule({ width: fixed(length), stroke: color, weight: 28 }),
    text(String(value), { width: fixed(80), height: fixed(44), style: { fontSize: 26, bold: true, color, textAlign: 'right' } }),
    text('', { width: fill, height: fixed(8), style: { fontSize: 1 } }),
    { width: fill, height: fixed(58), gap: 18, alignItems: 'center' },
  );
}

function addSlide(pres, name, root, background = C.cream) {
  const slide = pres.slides.add({ name });
  slide.background.fill = { color: background };
  slide.compose(root, { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 });
  return slide;
}

const pres = Presentation.create({ slideSize: { width: W, height: H } });

// 1 — Cover: restrained, type-led, with a single contextual photo band.
addSlide(pres, 'Cover', grid(
  column(
    row(kicker('Vitarich • Vita FMS'), logo(210), { width: fill, height: fixed(66), justifyContent: 'space-between', alignItems: 'center' }),
    text('TOTAL PROJECT\nUPDATE', { width: fill, height: fixed(224), style: { fontSize: 78, bold: true, color: C.deep, fontFamily: 'Bahnschrift' } }),
    text('May 1 – August 25, 2026', { width: fill, height: fixed(54), style: { fontSize: 28, bold: true, color: C.green } }),
    text('A connected view of operational delivery, module dependencies, release boundaries, and the decisions needed to convert build momentum into controlled adoption.', { width: fixed(1460), height: fixed(106), style: { fontSize: 23, color: C.muted } }),
    { width: fill, height: fill, gap: 12, padding: { top: 56, right: PAD, bottom: 18, left: PAD } },
  ),
  image({ dataUrl: assetData('integrated-campus.png'), width: fill, height: fill, fit: 'cover', alt: 'Integrated poultry operations campus' }),
  { width: fill, height: fill, columns: [fr(1)], rows: [fr(6.5), fr(5.5)] },
));

// 2 — Executive outcome.
addSlide(pres, 'Executive outcome', column(
  header('Executive read', 'The project is now an operating model—not a set of isolated screens.', 2),
  row(
    column(
      text('ONE CONNECTED\nOPERATING SPINE', { width: fill, height: fixed(210), style: { fontSize: 53, bold: true, color: C.green, fontFamily: 'Bahnschrift' } }),
      text('Farm identity, access control, inventory movement, production workflows, traceability, approvals, and notifications increasingly share the same foundation.', { width: fill, height: fixed(150), style: { fontSize: 23, color: C.ink } }),
      rule({ color: C.gold, thickness: 6, length: 540 }),
      { width: fixed(670), height: fill, gap: 18 },
    ),
    column(
      openMetric('98', 'integrated commits on dev-main'),
      openMetric('469', 'files changed from the April baseline', C.gold),
      openMetric('4', 'contributors across audited refs', C.lime),
      { width: fill, height: fill, gap: 24 },
    ),
    column(
      t('What this means', 20, C.gold, { bold: true }),
      t('• Broiler now has an end-to-end lifecycle from placement through clean-up.', 21),
      t('• Inventory is the shared posting and traceability backbone.', 21),
      t('• Hatchery and Breeder have material workflow coverage, with specific branch-only boundaries.', 21),
      t('• Governance shifted from route-level controls toward hierarchy, permissions, approvals, and centralized events.', 21),
      { width: fixed(660), height: fill, gap: 13 },
    ),
    { width: fill, height: fill, gap: 44, padding: { right: PAD, left: PAD } },
  ),
  footer(),
  { width: fill, height: fill, gap: 22, padding: { top: 45, right: 0, bottom: 28, left: 0 } },
));

// 3 — Delivery evidence with an authored, editable monthly comparison.
addSlide(pres, 'Delivery evidence', column(
  header('Delivery evidence', 'Sustained execution across four consecutive months', 3),
  row(
    column(
      kicker('Integrated commits by month'),
      barRow('MAY', 24, 610),
      barRow('JUNE', 27, 690, C.gold),
      barRow('JULY', 26, 660),
      barRow('AUG*', 21, 530, C.gold),
      t('98 integrated commits', 30, C.deep, { bold: true }),
      text('*Through August 21 integrated history; report current through August 25.', { width: fill, height: fixed(28), style: { fontSize: 13, color: C.muted } }),
      { width: fixed(1080), height: fixed(690), gap: 25 },
    ),
    column(
      openMetric('85,930', 'lines added from the April 29 baseline'),
      openMetric('7,483', 'lines removed—evidence of replacement and cleanup', C.gold),
      openMetric('3', 'feature commits still outside dev-main', C.red),
      t('Source: refreshed GitHub remote refs and local Git history.', 14, C.muted),
      { width: fill, height: fill, gap: 16 },
    ),
    { width: fill, height: fill, gap: 64, padding: { right: PAD, left: PAD } },
  ),
  footer(),
  { width: fill, height: fill, gap: 20, padding: { top: 45, bottom: 28 } },
));

// 4 — Architecture relationship map.
addSlide(pres, 'Portfolio architecture', column(
  header('Portfolio architecture', 'What is connected to what', 4),
  column(
    row(
      node('FARM + USER', 'Canonical farm identity • FMS scope • permissions', C.deep), arrow(),
      node('FMS WORKFLOWS', 'Broiler • Hatchery • Breeder', C.green), arrow(),
      node('INVENTORY LEDGER', 'Receipts • issues • transfers • signed postings', C.green), arrow(),
      node('REPORTING + TRACE', 'Warehouse balances • document lineage', C.deep),
      { width: fill, height: fixed(140), gap: 16, alignItems: 'center' },
    ),
    row(
      column(
        pill('CONFIGURATION LAYER', C.gold),
        t('Settings govern operational behavior: cycle rules, DOC placement, Flock Card, Harvest & Delivery, Clean-up, item groups, batch logic, and approvals.', 20),
        { width: fill, height: fixed(156), gap: 13 },
      ),
      text('↕', { width: fixed(80), height: fixed(70), style: { fontSize: 46, bold: true, color: C.gold, textAlign: 'center' } }),
      column(
        pill('CONTROL LAYER', C.deep),
        t('Central permissions, approval routing, notification rules, event catalog, deduplication, and farm-scoped recipient resolution.', 20),
        { width: fill, height: fixed(156), gap: 13 },
      ),
      { width: fill, height: fixed(170), gap: 38, alignItems: 'center' },
    ),
    column(
      t('Design principle', 17, C.gold, { bold: true }),
      t('Operational modules publish business outcomes; shared services decide authorization, routing, reporting, and delivery.', 28, C.deep, { bold: true }),
      { width: fill, height: fixed(132), gap: 8 },
    ),
    { width: fill, height: fill, gap: 46, padding: { right: PAD, left: PAD } },
  ),
  footer(),
  { width: fill, height: fill, gap: 18, padding: { top: 45, bottom: 28 } },
));

// 5 — Broiler dependency chain.
addSlide(pres, 'Broiler lifecycle', column(
  header('FMS category • Broiler', 'A governed production lifecycle from placement to close-out', 5),
  column(
    row(
      node('CYCLE MASTER', 'Farm-cycle authority'), arrow(),
      node('DOC PLACEMENT', 'Route: /inv/doc-receiving'), arrow(),
      node('GROWING & FARM CONDITION', 'Flock Card'), arrow(),
      node('HARVEST & DELIVERY', 'Batch allocation'), arrow(),
      node('CLEAN-UP', 'Closure + reconciliation'),
      { width: fill, height: fixed(146), gap: 8, alignItems: 'center' },
    ),
    row(
      column(kicker('Settings → operations'), t('DOC Placement Settings → DOC Placement', 22, C.deep, { bold: true }), t('Flock Card Settings → Growing & Farm Condition', 22, C.deep, { bold: true }), { width: fill, height: fixed(142), gap: 7 }),
      column(kicker('Settings → operations'), t('Harvest & Delivery Settings → Harvest & Delivery', 22, C.deep, { bold: true }), t('Clean-up Settings → Clean-up', 22, C.deep, { bold: true }), { width: fill, height: fixed(142), gap: 7 }),
      { width: fill, height: fixed(155), gap: 80 },
    ),
    row(
      column(openMetric('END-TO-END', 'placement, daily operations, delivery, and closure'), t('Inventory postings and farm cycle state connect each stage.', 18, C.muted), { width: fill, height: fixed(200) }),
      column(openMetric('CONTROLLED', 'date windows, batch rules, closure criteria'), t('Exact business rules are centralized in settings and shared validation.', 18, C.muted), { width: fill, height: fixed(200) }),
      column(openMetric('TRACEABLE', 'document, batch, farm, and source lineage'), t('Warehouse reporting provides the reconciliation view.', 18, C.muted), { width: fill, height: fixed(200) }),
      { width: fill, height: fixed(225), gap: 62 },
    ),
    { width: fill, height: fill, gap: 36, padding: { right: PAD, left: PAD } },
  ),
  footer(),
  { width: fill, height: fill, gap: 16, padding: { top: 45, bottom: 28 } },
));

// 6 — Inventory backbone with contextual image.
addSlide(pres, 'Inventory backbone', column(
  header('FMS category • Inventory', 'The shared transaction and reconciliation backbone', 6),
  row(
    image({ dataUrl: assetData('inventory-warehouse.png'), width: fixed(710), height: fixed(660), fit: 'cover', alt: 'Modern feed and inventory warehouse' }),
    column(
      row(node('ITEM MASTER'), arrow(), node('ITEM GROUP + UOM'), arrow(), node('BATCH'), { width: fill, height: fixed(95), gap: 14, alignItems: 'center' }),
      row(node('ITEM STOCK IN', 'Goods receipt'), arrow(), node('SIGNED POSTINGS', 'Canonical ledger'), arrow(), node('WAREHOUSE REPORT', 'Running balance + exports'), { width: fill, height: fixed(140), gap: 14, alignItems: 'center' }),
      row(node('ITEM STOCK OUT', 'Goods issue'), arrow(), node('TRANSFER', 'Origin ↔ destination'), arrow(), node('AUDIT TRAIL', 'Document lineage'), { width: fill, height: fixed(140), gap: 14, alignItems: 'center' }),
      rule({ color: C.gold, thickness: 5, length: 890 }),
      t('Connected consumers', 17, C.gold, { bold: true }),
      t('DOC Placement receives chicks • Flock Card consumes feed and mortality items • Harvest & Delivery allocates flock batches • Hatchery Receiving posts source inventory.', 22, C.deep, { bold: true }),
      { width: fill, height: fill, gap: 21 },
    ),
    { width: fill, height: fill, gap: 52, padding: { right: PAD, left: PAD } },
  ),
  footer(),
  { width: fill, height: fill, gap: 20, padding: { top: 45, bottom: 28 } },
));

// 7 — Hatchery chain.
addSlide(pres, 'Hatchery chain', column(
  header('FMS category • Hatchery', 'Receiving and egg-to-DOC process coverage', 7),
  row(
    column(
      image({ dataUrl: assetData('hatchery-interior.png'), width: fill, height: fixed(470), fit: 'cover', alt: 'Modern hatchery operations interior' }),
      text('Hatchery Receiving is a distinct module from Broiler DOC Placement.', { width: fill, height: fixed(62), style: { fontSize: 20, bold: true, color: C.deep, textAlign: 'center', verticalAlign: 'middle' } }),
      { width: fixed(650), height: fill, gap: 0 },
    ),
    column(
      row(node('RECEIVING'), arrow(), node('CLASSIFICATION'), arrow(), node('STORAGE'), arrow(), node('PRE-WARMING'), { width: fill, height: fixed(105), gap: 10, alignItems: 'center' }),
      row(node('SETTER'), arrow(), node('TRANSFER'), arrow(), node('HATCHER'), arrow(), node('CHICK PULLOUT'), { width: fill, height: fixed(105), gap: 10, alignItems: 'center' }),
      row(node('DOC CLASSIFICATION'), arrow(), node('DOC DISPATCH'), arrow(), node('DISPOSAL'), { width: fill, height: fixed(105), gap: 12, alignItems: 'center' }),
      rule({ color: C.gold, thickness: 5, length: 930 }),
      t('Connected services', 17, C.gold, { bold: true }),
      t('Receiving → Inventory postings • Process steps → shared batch/source trace • Dispatch → downstream placement lineage • Permissions and notifications → centralized control.', 22, C.deep, { bold: true }),
      t('Current boundary: module coverage is substantial; end-to-end browser, SQL, and notification delivery verification remains an operational gate.', 17, C.muted),
      { width: fill, height: fill, gap: 22 },
    ),
    { width: fill, height: fill, gap: 52, padding: { right: PAD, left: PAD } },
  ),
  footer(),
  { width: fill, height: fill, gap: 20, padding: { top: 45, bottom: 28 } },
));

// 8 — Breeder chain and branch boundary.
addSlide(pres, 'Breeder chain', column(
  header('FMS category • Breeder', 'Production records are integrated; logistics enhancements remain branch-only', 8),
  column(
    row(node('PLACEMENT'), arrow(), node('POPULATION RECORD'), arrow(), node('LAYING PRODUCTION'), arrow(), node('VACCINATION + MEDICATION'), arrow(), node('REPORTS'), { width: fill, height: fixed(150), gap: 10, alignItems: 'center' }),
    row(
      column(pill('INTEGRATED ON DEV-MAIN', C.green), t('Growing and grading workflows • Breeder navigation • core production records • shared farm and permission controls.', 22), { width: fill, height: fixed(174), gap: 14 }),
      column(pill('BRANCH-ONLY: DEV-BAJA', C.red), t('Breeder Dispatch • Clean-up • Transfer • History/Card enhancements. These are visible in remote history but not counted as released on dev-main.', 22), { width: fill, height: fixed(174), gap: 14 }),
      { width: fill, height: fixed(190), gap: 70 },
    ),
    column(
      t('Release implication', 17, C.gold, { bold: true }),
      t('Decide whether the branch-only logistics chain is production-ready, requires reconciliation with dev-main, or should be staged behind a controlled acceptance gate.', 29, C.deep, { bold: true }),
      { width: fill, height: fixed(142), gap: 10 },
    ),
    { width: fill, height: fill, gap: 55, padding: { right: PAD, left: PAD } },
  ),
  footer(),
  { width: fill, height: fill, gap: 18, padding: { top: 45, bottom: 28 } },
));

// 9 — Shared governance.
addSlide(pres, 'Shared governance', column(
  header('Shared platform', 'The controls that connect every FMS category', 9),
  row(
    column(
      text('GOVERNANCE\nSPINE', { width: fill, height: fixed(150), style: { fontSize: 52, bold: true, color: C.deep, fontFamily: 'Bahnschrift' } }),
      text('Authorization and configuration are moving from scattered route logic into shared, farm-aware services.', { width: fill, height: fixed(120), style: { fontSize: 24, color: C.muted } }),
      rule({ color: C.gold, thickness: 6, length: 490 }),
      { width: fixed(570), height: fill, gap: 20 },
    ),
    grid(
      column(pill('IDENTITY', C.deep), t('User Management\nFMS Type\nFarm assignments', 20, C.ink, { bold: true }), { width: fill, height: fill, gap: 18 }),
      column(pill('ACCESS', C.green), t('User Permissions\nUser Groups\nActivation controls', 20, C.ink, { bold: true }), { width: fill, height: fill, gap: 18 }),
      column(pill('DECISIONS', C.gold), t('Approval Setup\nApproval Management\nWeek Lock boundary', 20, C.ink, { bold: true }), { width: fill, height: fill, gap: 18 }),
      column(pill('EVENTS', C.green), t('Notification catalog\nCentral dispatcher\nFarm-aware routing', 20, C.ink, { bold: true }), { width: fill, height: fill, gap: 18 }),
      column(pill('FARM SETUP', C.deep), t('Farm Management\nSetup Wizard\nWarehouse hierarchy', 20, C.ink, { bold: true }), { width: fill, height: fill, gap: 18 }),
      column(pill('OPERABILITY', C.gold), t('Navigation + search\nTheme consistency\nOffline/reliability work', 20, C.ink, { bold: true }), { width: fill, height: fill, gap: 18 }),
      { width: fill, height: fixed(505), columns: [fr(1), fr(1), fr(1)], rows: [fr(1), fr(1)], columnGap: 38, rowGap: 42 },
    ),
    { width: fill, height: fill, gap: 75, padding: { right: PAD, left: PAD } },
  ),
  footer(),
  { width: fill, height: fill, gap: 22, padding: { top: 45, bottom: 28 } },
));

// 10 — Timeline.
addSlide(pres, 'Timeline', column(
  header('May–August 2026', 'The build moved from visibility to integration to control', 10),
  column(
    row(
      column(text('MAY', { width: fill, height: fixed(80), style: { fontSize: 54, bold: true, color: C.green, fontFamily: 'Bahnschrift' } }), t('Visibility + adoption', 24, C.deep, { bold: true }), t('Hatchery views/APIs • receiving trace • permissions templates • table standardization', 18, C.muted), { width: fill, height: fixed(230), gap: 9 }),
      column(text('JUN', { width: fill, height: fixed(80), style: { fontSize: 54, bold: true, color: C.green, fontFamily: 'Bahnschrift' } }), t('Inventory foundation', 24, C.deep, { bold: true }), t('Reversal validation • Item Group • UoM • Batch • stock-in/out • breeder growing/grading', 18, C.muted), { width: fill, height: fixed(230), gap: 9 }),
      column(text('JUL', { width: fill, height: fixed(80), style: { fontSize: 54, bold: true, color: C.green, fontFamily: 'Bahnschrift' } }), t('Connected operations', 24, C.deep, { bold: true }), t('Broiler lifecycle • Flock Card • Harvest & Delivery • Clean-up • transfers • warehouse reports', 18, C.muted), { width: fill, height: fixed(230), gap: 9 }),
      column(text('AUG', { width: fill, height: fixed(80), style: { fontSize: 54, bold: true, color: C.green, fontFamily: 'Bahnschrift' } }), t('Governance + readiness', 24, C.deep, { bold: true }), t('Cycle Master • access hierarchy • notifications • reliability • hierarchy refinement • WIP validation', 18, C.muted), { width: fill, height: fixed(230), gap: 9 }),
      { width: fill, height: fixed(255), gap: 52 },
    ),
    rule({ color: C.gold, thickness: 7, length: 1660 }),
    row(
      openMetric('24', 'May commits'),
      openMetric('27', 'June commits', C.gold),
      openMetric('26', 'July commits'),
      openMetric('21', 'August commits through Aug 21', C.gold),
      { width: fill, height: fixed(190), gap: 55 },
    ),
    text('The sequencing matters: shared inventory and traceability foundations enabled the Broiler lifecycle; that lifecycle then exposed the need for stronger farm identity, permissions, approvals, and notification controls.', { width: fill, height: fixed(120), style: { fontSize: 25, bold: true, color: C.deep, textAlign: 'center' } }),
    { width: fill, height: fill, gap: 50, padding: { right: PAD, left: PAD } },
  ),
  footer(),
  { width: fill, height: fill, gap: 18, padding: { top: 45, bottom: 28 } },
));

// 11 — Release boundary.
addSlide(pres, 'Release boundary', column(
  header('Release boundary', 'Built is not the same as integrated, deployed, or verified', 11),
  column(
    row(
      column(pill('INTEGRATED', C.green), text('98', { width: fill, height: fixed(110), style: { fontSize: 72, bold: true, color: C.green, textAlign: 'center', fontFamily: 'Bahnschrift' } }), t('commits on origin/dev-main', 20, C.deep, { bold: true, textAlign: 'center' }), { width: fill, height: fixed(220), gap: 10 }),
      column(pill('BRANCH-ONLY', C.red), text('3', { width: fill, height: fixed(110), style: { fontSize: 72, bold: true, color: C.red, textAlign: 'center', fontFamily: 'Bahnschrift' } }), t('feature commits outside dev-main', 20, C.deep, { bold: true, textAlign: 'center' }), { width: fill, height: fixed(220), gap: 10 }),
      column(pill('LOCAL WIP', C.gold), text('52', { width: fill, height: fixed(110), style: { fontSize: 72, bold: true, color: C.gold, textAlign: 'center', fontFamily: 'Bahnschrift' } }), t('pre-existing changed/untracked code paths', 20, C.deep, { bold: true, textAlign: 'center' }), { width: fill, height: fixed(220), gap: 10 }),
      column(pill('VERIFICATION', C.deep), text('OPEN', { width: fill, height: fixed(110), style: { fontSize: 54, bold: true, color: C.deep, textAlign: 'center', fontFamily: 'Bahnschrift' } }), t('browser, SQL/RPC, RLS, Supabase, and delivery checks', 20, C.deep, { bold: true, textAlign: 'center' }), { width: fill, height: fixed(220), gap: 10 }),
      { width: fill, height: fixed(245), gap: 35 },
    ),
    row(
      column(kicker('Release control'), t('Promote by evidence', 29, C.deep, { bold: true }), t('Require commit/branch identity, migration status, automated checks, browser acceptance, and owner sign-off for every release candidate.', 20), { width: fill, height: fixed(190), gap: 8 }),
      column(kicker('Operational control'), t('Pilot by workflow', 29, C.deep, { bold: true }), t('Validate the connected chain—not a single page: settings → document → posting → report → notification/approval.', 20), { width: fill, height: fixed(190), gap: 8 }),
      column(kicker('Risk control'), t('Protect the data contract', 29, C.deep, { bold: true }), t('Preserve farm identity, signed ledger behavior, source lineage, retry deduplication, and safe notification no-op behavior.', 20), { width: fill, height: fixed(190), gap: 8 }),
      { width: fill, height: fixed(210), gap: 55 },
    ),
    text('Management message: delivery momentum is strong; the immediate value unlock is disciplined integration and operational acceptance.', { width: fill, height: fixed(100), style: { fontSize: 29, bold: true, color: C.green, textAlign: 'center' } }),
    { width: fill, height: fill, gap: 48, padding: { right: PAD, left: PAD } },
  ),
  footer(),
  { width: fill, height: fill, gap: 18, padding: { top: 45, bottom: 28 } },
));

// 12 — CEO priorities.
addSlide(pres, 'CEO priorities', column(
  header('CEO priorities', 'Six decisions to turn build momentum into measurable operating value', 12),
  grid(
    column(text('01', { width: fill, height: fixed(72), style: { fontSize: 46, bold: true, color: C.gold, fontFamily: 'Bahnschrift' } }), t('Approve a controlled release gate', 25, C.deep, { bold: true }), t('One evidence pack covering code, SQL/RPC, browser, RLS, notification, and rollback readiness.', 18, C.muted), { width: fill, height: fill, gap: 6 }),
    column(text('02', { width: fill, height: fixed(72), style: { fontSize: 46, bold: true, color: C.gold, fontFamily: 'Bahnschrift' } }), t('Prioritize Broiler pilot adoption', 25, C.deep, { bold: true }), t('Run placement → Flock Card → delivery → clean-up with reconciled warehouse balances.', 18, C.muted), { width: fill, height: fill, gap: 6 }),
    column(text('03', { width: fill, height: fixed(72), style: { fontSize: 46, bold: true, color: C.gold, fontFamily: 'Bahnschrift' } }), t('Resolve branch-only Breeder scope', 25, C.deep, { bold: true }), t('Accept, reconcile, or defer Dispatch/Clean-up/Transfer/History as an explicit release decision.', 18, C.muted), { width: fill, height: fill, gap: 6 }),
    column(text('04', { width: fill, height: fixed(72), style: { fontSize: 46, bold: true, color: C.gold, fontFamily: 'Bahnschrift' } }), t('Freeze canonical farm identity', 25, C.deep, { bold: true }), t('Complete numeric farm-ID migration and stop ambiguous farm code/name routing.', 18, C.muted), { width: fill, height: fill, gap: 6 }),
    column(text('05', { width: fill, height: fixed(72), style: { fontSize: 46, bold: true, color: C.gold, fontFamily: 'Bahnschrift' } }), t('Name operational owners', 25, C.deep, { bold: true }), t('Assign one accountable owner per FMS category for acceptance, adoption, and master-data quality.', 18, C.muted), { width: fill, height: fill, gap: 6 }),
    column(text('06', { width: fill, height: fixed(72), style: { fontSize: 46, bold: true, color: C.gold, fontFamily: 'Bahnschrift' } }), t('Track three value measures', 25, C.deep, { bold: true }), t('Posting accuracy • cycle close time • exception resolution time—reported by farm and workflow.', 18, C.muted), { width: fill, height: fill, gap: 6 }),
    { width: fill, height: fill, columns: [fr(1), fr(1), fr(1)], rows: [fr(1), fr(1)], columnGap: 58, rowGap: 50, padding: { right: PAD, left: PAD } },
  ),
  text('CONNECTED • CONTROLLED • PROVABLY LIVE', { width: fill, height: fixed(58), style: { fontSize: 29, bold: true, color: C.deep, textAlign: 'center', verticalAlign: 'middle', letterSpacing: 2.4 } }),
  footer(),
  { width: fill, height: fill, gap: 20, padding: { top: 45, bottom: 28 } },
));

const pptxPath = path.join(OUT, 'Vita-FMS-CEO-Project-Update-May-August-2026.pptx');
const deckBlob = await PresentationFile.exportPptx(pres);
await deckBlob.save(pptxPath);

async function saveWebBlob(blob, filePath) {
  fs.writeFileSync(filePath, Buffer.from(await blob.arrayBuffer()));
}

for (let i = 0; i < pres.slides.items.length; i += 1) {
  const blob = await pres.export({ slide: pres.slides.items[i], format: 'png', scale: 1 });
  await saveWebBlob(blob, path.join(RENDER, `slide-${String(i + 1).padStart(2, '0')}.png`));
}

const savedBytes = fs.readFileSync(pptxPath);
const reloaded = await PresentationFile.importPptx(savedBytes);
for (let i = 0; i < reloaded.slides.items.length; i += 1) {
  const blob = await reloaded.export({ slide: reloaded.slides.items[i], format: 'png', scale: 1 });
  await saveWebBlob(blob, path.join(VERIFY, `slide-${String(i + 1).padStart(2, '0')}.png`));
}

console.log(JSON.stringify({ pptxPath, slideCount: pres.slides.items.length, renderDir: RENDER, verifyDir: VERIFY }));
