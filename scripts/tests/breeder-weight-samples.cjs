// Run: node scripts/tests/breeder-weight-samples.cjs
// Executes production calculations and repositories with an in-memory DB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function loader(mocks) {
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

async function main() {
  const calc = loader({})('app/jmb/lib/breederWeightSamples');
  const same = Array(50).fill(1000);
  assert.deepEqual(calc.calculateWeightSamples(same), { sampleCount: 50, mean: 1000, withinRange: 50, uniformity: 100 });
  const boundary = [...Array(46).fill(1000), 900, 1100, 899, 1101];
  assert.deepEqual(calc.calculateWeightSamples(boundary), { sampleCount: 50, mean: 1000, withinRange: 48, uniformity: 96 });
  const none = [...Array(25).fill(500), ...Array(25).fill(1500)];
  assert.equal(calc.calculateWeightSamples(none).uniformity, 0, 'Zero uniformity is a real result');
  assert.equal(calc.calculateWeightSamples([...Array(48).fill(10.3), 9.27, 11.33]).uniformity, 100, 'Decimal boundary is inclusive');
  for (const bad of [[], same.slice(1), [...same, 1000], [0, ...same.slice(1)], [-1, ...same.slice(1)], [NaN, ...same.slice(1)], [Infinity, ...same.slice(1)]]) {
    assert.equal(calc.calculateWeightSamples(bad), null);
  }
  assert.deepEqual(calc.parseWeightPaste('1000\r\n900.5\t1100', 50), ['1000', '900.5', '1100']);
  for (const [text, count] of [['1\n2', 1], ['0', 50], ['-5', 50], ['weight', 50], ['', 50]]) {
    assert.throws(() => calc.parseWeightPaste(text, count));
  }

  const placement = (id, farm, date) => ({ id, farm_id: farm, cycle_id: id, placement_date: date, farm_name: `Farm ${farm}`, building_id: id, building_no: `House ${id}`, pen_no: 'Pen 1', f_endingbalance: 500, m_endingbalance: 100 });
  const sample = (id, placementId, farm, date, male = same, female = boundary) => ({
    id, placement_id: placementId, farm_id: farm, sample_date: date, male_weights: male, female_weights: female,
    male_mean: calc.calculateWeightSamples(male).mean, female_mean: calc.calculateWeightSamples(female).mean,
    male_uniformity: calc.calculateWeightSamples(male).uniformity, female_uniformity: calc.calculateWeightSamples(female).uniformity,
    revision: 1,
  });
  const tables = {
    tbl_placement: [placement(1, 10, '2026-09-01'), placement(2, 20, '2026-09-02'), placement(3, 10, '2026-08-01')],
    tbl_breeder_daily_performance: [{ id: 1, placement_id: 1, daterec: '2026-09-08', isactive: true, inv_male: 100, inv_female: 500, m_body_weight: 1200, f_body_weight: 1250, m_uniformity: 99, f_uniformity: 99 }],
    breeder_weight_samples: [sample(1, 1, 10, '2026-09-07'), sample(2, 2, 20, '2026-09-10', none), sample(3, 3, 10, '2026-09-10', none), sample(4, 1, 10, '2026-09-20', none)],
  };
  let unavailable = false;
  const rpcCalls = [];
  const db = {
    from(table) {
      let rows = [...(tables[table] ?? [])], start = 0, end = 999;
      const orders = [];
      const query = {
        select() { return query; },
        in(key, values) { rows = rows.filter(row => values.includes(row[key])); return query; },
        eq(key, value) { rows = rows.filter(row => row[key] === value); return query; },
        lte(key, value) { rows = rows.filter(row => row[key] <= value); return query; },
        gte(key, value) { rows = rows.filter(row => row[key] >= value); return query; },
        order(key, options) { orders.push([key, options?.ascending === false ? -1 : 1]); return query; },
        range(from, to) { start = from; end = to; return query; },
        then(resolve, reject) {
          rows.sort((a, b) => { for (const [key, dir] of orders) { const diff = (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * dir; if (diff) return diff; } return 0; });
          return Promise.resolve(unavailable && table === 'breeder_weight_samples'
            ? { error: { code: 'PGRST205' }, data: null }
            : { error: null, data: rows.slice(start, end + 1) }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, params) { rpcCalls.push({ name, params }); return { data: [tables.breeder_weight_samples[0]], error: null }; },
  };
  const load = loader({ '@/lib/Supabase/supabaseClient': { db }, '@/app/jmb/placement/new/api': { listBreederCycles: async () => tables.tbl_placement.map(row => ({ id: row.id, status: 'active' })) } });
  const repository = load('app/jmb/lib/data/repositories/breederWeightSamples');
  const dashboard = load('app/jmb/lib/data/repositories/breederDashboard');
  const filter = { farmId: 10, from: '2026-09-01', to: '2026-09-10' };
  let result = await dashboard.getBreederDashboard(filter);
  assert.equal(result.latestUniformity.male.value, 100, 'Other farms, other flocks and future samples cannot replace the selected flock');
  assert.equal(result.latestUniformity.female.value, 96);
  assert.equal(result.latestUniformity.male.sampleCount, 50);
  assert.equal(result.latestUniformity.male.ageDays, 7, 'Placement day is day 1; Sep 7 is age 1.0');
  assert.equal(result.weeklyBodyWeights.find(row => row.placementId === 1).male.value, 1200, 'Newer manual body weight is retained');
  tables.breeder_weight_samples.push(sample(5, 1, 10, '2026-09-09', none));
  result = await dashboard.getBreederDashboard(filter);
  assert.equal(result.latestUniformity.male.value, 0);
  assert.equal(result.latestUniformity.male.date, '2026-09-09');
  assert.equal(result.weeklyBodyWeights.find(row => row.placementId === 1).male.value, 1000, 'Latest sample mean feeds the comparison');
  tables.breeder_weight_samples.push(sample(6, 1, 20, '2026-09-10', same));
  result = await dashboard.getBreederDashboard(filter);
  assert.equal(result.latestUniformity.male.date, '2026-09-09', 'Mismatched persisted sample farm cannot be attributed to the current farm');
  assert.equal((await repository.listBreederWeightSamples({ placementIds: [1], from: '2026-09-09', to: '2026-09-09' })).records.length, 1);

  unavailable = true;
  result = await dashboard.getBreederDashboard(filter);
  assert.equal(result.weightSampleStorageAvailable, false);
  assert.equal(result.latestUniformity.male, null, 'Manual percent never masquerades as a 50-sample result');
  assert.ok(result.buildings.length > 0, 'Missing sample migration does not break other KPIs');
  unavailable = false;
  const saveInput = { placementId: 1, date: '2026-09-07', male: same, female: boundary, expectedRevision: 1, requestKey: 'test-request-key' };
  assert.equal((await repository.saveBreederWeightSamples(saveInput)).id, 1, 'Normalize a PostgREST composite result');
  assert.equal(rpcCalls.length, 1);
  assert.deepEqual(rpcCalls[0].params.p_female_weights, boundary, 'All individual values reach the authoritative RPC');
  assert.equal(rpcCalls[0].params.p_request_key, saveInput.requestKey);
  await assert.rejects(repository.saveBreederWeightSamples({ ...saveInput, male: same.slice(1) }));
  assert.equal(rpcCalls.length, 1, 'Partial samples cannot be submitted');

  console.log('Passed: 50-sample validation, inclusive boundaries, paste, sex separation, farm/flock/date filtering, body-weight selection, storage fallback, save payload.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
