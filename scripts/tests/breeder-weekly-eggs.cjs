// Run: node scripts/tests/breeder-weekly-eggs.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    let resolved = path.resolve(root, file);
    if (!path.extname(resolved)) resolved += '.ts';
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const mod = { exports: {} };
    cache.set(resolved, mod);
    const code = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', code)(specifier => {
      if (specifier in mocks) return mocks[specifier];
      if (specifier.startsWith('@/')) return load(specifier.slice(2));
      if (specifier.startsWith('.')) return load(path.resolve(path.dirname(resolved), specifier));
      return require(specifier);
    }, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
const load = loader();
const { calculateEggRangeProduction: calculate } = load('app/jmb/lib/breederWeeklyEggProduction');
const { cobbEggProductionTarget: target } = load('app/jmb/lib/data/queries/cobb500BreederEggProduction');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const day = age => new Date(Date.parse('2026-01-01T00:00:00Z') + (age - 1) * 86400000).toISOString().slice(0, 10);
const placement = (id, farm = 1, building = 1, females = 100) => ({ id, farm_id: farm, building_id: building, farm_name: `Farm ${farm}`, building_no: `House ${building}`, placement_date: day(1), f_endingbalance: females });
const egg = (age, tep = 150, good = 135, id = age, p = 1, farm = 1, building = 1) => ({ id, placement_id: p, farm_id: farm, building_id: building, date_laying: day(age), tep_collection: tep, hatching_egg: good, is_active: true });
const population = (id, age, females, changes = {}) => ({ id: id * 1000 + age, placement_id: id, daterec: day(age), inv_female: females, inv_male: 9999, trans_in_female: 0, trans_out_female: 0, mc_female: 0, cull_female: 0, kitchen_female: 0, condem_female: 0, ...changes });

async function main() {
  assert.equal(target(161), null);
  assert.equal(target(162).week, 24);
  assert.equal(target(168).totalEggPercent, 3);
  assert.equal(target(169).totalEggPercent, 22);
  assert.equal(target(175).week, 25);
  assert.equal(target(176).totalEggPercent, 53);
  assert.equal(target(455).totalEggPercent, 43.7);
  assert.equal(target(456), null);
  assert.equal(target(null), null);
  const records = Array.from({ length: 7 }, (_, index) => egg(211 + index));
  const input = { from: day(190), to: day(217), farmId: 1, placements: [placement(1), placement(2)], performance: [], eggs: [egg(204, 999), ...records] };
  let result = calculate(input);
  assert.equal(result.buildings[0].from, day(190));
  assert.equal(result.buildings[0].to, day(217));
  assert.equal(result.buildings[0].recordedDays, 8);
  assert.equal(result.buildings[0].partial, true);
  assert.equal(result.totals.totalEggs, 2049, 'Every selected production date is included');
  assert.equal(result.totals.averageLiveFemales, 200, 'Building numerator uses both pens for the denominator');
  close(result.totals.productionPercent, 128.0625);
  close(result.totals.standardPercent, 85.825);
  close(result.totals.standardEggs, 1373.2);
  close(result.totals.eggsPerHen, 10.245);
  close(result.totals.standardEggsPerHen, 6.866);
  close(result.totals.hatchRecovery, 1080 / 2049 * 100);

  result = calculate({ ...input, from: day(214), to: day(216) });
  assert.equal(result.buildings[0].recordedDays, 3);
  assert.equal(result.buildings[0].partial, false);
  assert.equal(result.totals.totalEggs, 450);
  close(result.totals.standardEggs, 514.8);
  close(result.totals.eggsPerHen, 2.25, 'Partial range is not extrapolated');
  result = calculate({ ...input, eggs: [egg(211), egg(213)] });
  assert.equal(result.buildings[0].recordedDays, 2);
  close(result.totals.productionPercent, 75, 'Unrecorded dates are not invented as zero-production days');
  close(result.totals.standardEggs, 343.2, 'Actual and standard use identical recorded-day coverage');

  result = calculate({ ...input, performance: [population(1, 210, 100, { mc_female: 10 }), population(2, 211, 100, { trans_in_female: 10, trans_out_female: 5 })] });
  close(result.totals.averageLiveFemales, 195.625, 'Carry prior closing balances and include transfers across the selected range');
  result = calculate({ ...input, placements: [placement(1, 1, 1, null), placement(2)] });
  assert.equal(result.totals.productionPercent, null);
  assert.equal(result.totals.standardEggs, null);
  assert.equal(result.totals.totalEggs, 2049);
  close(result.totals.hatchRecovery, 1080 / 2049 * 100, 'Recovery does not depend on population availability');
  result = calculate({ ...input, eggs: [egg(211, 0, 0)] });
  assert.equal(result.totals.totalEggs, 0);
  assert.equal(result.totals.productionPercent, 0);
  assert.equal(result.totals.hatchRecovery, null);
  result = calculate({ ...input, eggs: [egg(211, 150, 151)] });
  assert.equal(result.totals.hatchRecovery, null, 'Invalid good eggs cannot produce a rate above 100%');
  result = calculate({ ...input, eggs: [egg(211), egg(211, 150, 135, 999)] });
  assert.equal(result.totals.totalEggs, null, 'Duplicate building/date records need review instead of being double-counted');
  result = calculate({ ...input, eggs: [egg(211), egg(211)] });
  assert.equal(result.totals.totalEggs, 150, 'Repeated source IDs are counted once');

  result = calculate({ ...input, eggs: [...records, egg(217, 999, 999, 999, 1, 2), { ...egg(217, 999, 999, 998), is_active: false }, egg(218, 999, 999), egg(217, 999, 999, 997, 1, 1, 9)] });
  assert.equal(result.totals.totalEggs, 1050, 'Farm, inactive, future and mismatched-building records excluded');
  assert.equal(result.excludedRecords, 1);
  result = calculate({ ...input, placements: [...input.placements, placement(3, 1, 2)], eggs: [...records, ...Array.from({ length: 7 }, (_, index) => egg(211 + index, 80, 40, 900 + index, 3, 1, 2))] });
  close(result.totals.hatchRecovery, 1225 / 1610 * 100, 'Weighted recovery, not the average of building rates');
  assert.equal(calculate({ ...input, eggs: [] }).totals.totalEggs, null);

  // Exercise the reused query: >1000 rows, ID chunking, stable order and filters.
  const queryRows = Array.from({ length: 1105 }, (_, index) => egg(211 + index % 7, 1, 1, index + 1, 1));
  queryRows.push({ ...egg(211, 1, 1, 9000), is_active: false }, egg(211, 1, 1, 9001, 1, 2));
  let calls = 0;
  const db = { from(table) {
    assert.equal(table, 'tbl_egglaying'); calls++;
    let rows = [...queryRows], start = 0, end = 999;
    const orders = [];
    const q = {
      select() { return q; }, eq(k, v) { rows = rows.filter(row => row[k] === v); return q; },
      in(k, values) { rows = rows.filter(row => values.includes(row[k])); return q; },
      gte(k, v) { rows = rows.filter(row => row[k] >= v); return q; }, lte(k, v) { rows = rows.filter(row => row[k] <= v); return q; },
      order(k, opts) { orders.push([k, opts.ascending ? 1 : -1]); return q; }, range(a, b) { start = a; end = b; return q; },
      then(resolve, reject) {
        rows.sort((a, b) => { for (const [k, d] of orders) { const diff = (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * d; if (diff) return diff; } return 0; });
        return Promise.resolve({ data: rows.slice(start, end + 1), error: null }).then(resolve, reject);
      },
    }; return q;
  } };
  const repo = loader({ '@/lib/Supabase/supabaseClient': { db } })('app/jmb/lib/data/repositories/breederEggLaying');
  const saved = await repo.listBreederEggLayings({ placementIds: Array.from({ length: 301 }, (_, i) => i + 1), farmId: 1, from: day(211), to: day(217), ascending: true });
  assert.equal(saved.length, 1105);
  assert.equal(calls, 3, 'Pagination and placement chunks both execute');
  assert.ok(saved.every((row, i) => !i || saved[i - 1].date_laying <= row.date_laying));
  assert.deepEqual(await repo.listBreederEggLayings({ placementIds: [] }), []);
  console.log('Passed: production-date-range totals, two-pen building totals, partial/missing days, standards, weighted rates, live balances, zero/missing/invalid data, farm filtering and pagination.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
