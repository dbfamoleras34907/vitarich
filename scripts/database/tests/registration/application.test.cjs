const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { test } = require('node:test')

function load(file, mocks = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(source, { module, exports: module.exports, URL, console, process: { env: {} }, require: key => {
    if (key in mocks) return mocks[key]
    throw new Error(`Unexpected dependency: ${key}`)
  } }, { filename: file })
  return module.exports
}
const personal = load('lib/auth/personalInformation.ts')
const complete = { firstname: 'First', lastname: 'Last', birthdate: '1990-01-01T00:00:00', location: 'Office', region: 'Region', archipelago: 'Island', isactive: '1', approval_status: 'activated' }
function server(db) {
  return load('lib/data/repositories/registration.server.ts', {
    '@/lib/Supabase/supabaseAdmin': { admin_db: db },
    '@/lib/networkError': { isServiceUnavailableError: () => false },
    '@/lib/auth/personalInformation': personal,
  })
}
function profileDb(profile, error = null) {
  return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error }) }) }) }) }
}

test('Signup never signs in and performs one registration request', async () => {
  let requests = 0
  const api = load('lib/data/repositories/registration.ts', {
    '@/lib/Supabase/supabaseClient': { db: { auth: new Proxy({}, { get() { throw new Error('Signup accessed Auth client') } }) } },
    '@/lib/network/http': { fetchWithInternetErrorNotice: async () => { requests++; return { ok: true } }, readJsonResponse: async () => ({ success: true }) },
  })
  await api.registerAccount({ email: 'person@example.test', password: 'Password1' })
  assert.equal(requests, 1)
})

test('Missing migration prevents Auth account creation', async () => {
  const api = server({ rpc: async () => ({ error: { code: 'PGRST202' } }), auth: { admin: { createUser: () => { throw new Error('Orphan account created') } } } })
  await assert.rejects(api.createRegistrationAccount({ email: 'person@example.test', password: 'Password1' }), error => error.status === 503)
})

test('Auth creation is banned and uses server-owned approval marker', async () => {
  let payload
  const api = server({ rpc: async () => ({ data: true }), auth: { admin: { createUser: async input => { payload = input; return { data: { user: { id: 'new-user' } } } } } } })
  await api.createRegistrationAccount({ email: 'person@example.test', password: 'Password1' })
  assert.equal(payload.ban_duration, '876000h')
  assert.equal(payload.app_metadata.registration_flow, 'approval_first')
})

test('Timestamp birthdates count as complete and incomplete/rejected states are independent', async () => {
  const status = await server(profileDb(complete)).getAccountAccessByAuthId('id')
  assert.equal(status.profileComplete, true)
  assert.equal(status.profile.birthdate, '1990-01-01')
  assert.equal((await server(profileDb({ ...complete, firstname: '' })).getAccountAccessByAuthId('id')).profileComplete, false)
  assert.equal((await server(profileDb({ ...complete, approval_status: 'rejected' })).getAccountAccessByAuthId('id')).approvalStatus, 'rejected')
  await assert.rejects(server(profileDb(null, new Error('offline'))).getAccountAccessByAuthId('id'), error => error.status === 503)
})

test('Profile writes strip farm, approval and role fields and identify the caller from the token', async () => {
  let payload
  const api = server({ auth: { getUser: async () => ({ data: { user: { id: 'verified-user' } } }) }, rpc: async (name, input) => { payload = input; return {} } })
  await api.saveRegistrationProfile('token', { ...complete, birthdate: '1990-01-01', auth_id: 'another-user', user_type: 1, farm_id: 99 })
  assert.equal(payload.p_auth_id, 'verified-user')
  assert.equal(payload.p_profile.user_type, undefined)
  assert.equal(payload.p_profile.auth_id, undefined)
  assert.equal(payload.p_profile.farm_id, undefined)
})

test('Decision emails escape reasons and provide a login link only after activation', () => {
  const { buildAccountDecisionEmail } = load('lib/email/accountDecisionTemplate.ts')
  const rejected = buildAccountDecisionEmail('ACCOUNT_REJECTED', '<script>alert(1)</script>', '')
  assert.ok(!rejected.html.includes('<script>'))
  assert.ok(rejected.html.includes('&lt;script&gt;'))
  const approved = buildAccountDecisionEmail('ACCOUNT_ACTIVATED', '', 'https://fms.example.test')
  assert.ok(approved.html.includes('href="https://fms.example.test/login"'))
  assert.throws(() => buildAccountDecisionEmail('ACCOUNT_ACTIVATED', '', ''))
})

function proxyFor(access, user = { id: 'user' }) {
  const response = (kind, body, status) => ({ kind, body, status, cookies: { getAll: () => [], set: () => {} } })
  const next = { next: () => response('next'), json: (body, init) => response('json', body, init.status), redirect: url => response('redirect', url.pathname) }
  return load('proxy.ts', {
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user } }), signOut: async () => {} } }) },
    'next/server': { NextResponse: next },
    '@/lib/data/repositories/registration.server': { getAccountAccessByAuthId: async () => { if (access instanceof Error) throw access; return access }, RegistrationError: class extends Error {} },
  }).proxy
}
function request(path) { return { nextUrl: { pathname: path }, url: 'https://fms.example.test' + path, headers: { get: () => null }, cookies: { get: () => null } } }

test('Direct URLs, prefetched pages and APIs enforce completion; the completion endpoint stays usable', async () => {
  const gate = proxyFor({ approvalStatus: 'activated', profileComplete: false })
  assert.equal((await gate(request('/brd/fc'))).body, '/signup_update')
  assert.equal((await gate(request('/api/admin/userActivation'))).status, 403)
  assert.equal((await gate(request('/api/auth/registration-profile'))).kind, 'next')
  assert.equal((await gate(request('/signup_update'))).kind, 'next')
  assert.equal((await gate(request('/logout'))).kind, 'next')
})

test('Public signup stays available, rejected accounts are blocked, complete accounts proceed', async () => {
  assert.equal((await proxyFor(null, null)(request('/api/auth/register'))).kind, 'next')
  assert.equal((await proxyFor(null, null)(request('/signup'))).kind, 'next')
  assert.equal((await proxyFor(null, null)(request('/signup_update'))).body, '/login')
  assert.equal((await proxyFor({ approvalStatus: 'rejected', profileComplete: true })(request('/api/dispatch'))).status, 403)
  assert.equal((await proxyFor({ approvalStatus: 'activated', profileComplete: true })(request('/home'))).kind, 'next')
})


test('Only a missing approval_status column enables legacy active-account access', async () => {
  for (const active of ['1', '0']) {
    let calls = 0
    const api = server({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
      calls++
      return calls === 1
        ? { data: null, error: { code: '42703', message: 'column users.approval_status does not exist' } }
        : { data: { ...complete, firstname: '', isactive: active }, error: null }
    } }) }) }) })
    const status = await api.getAccountAccessByAuthId('id')
    assert.equal(status.registrationReady, false)
    assert.equal(status.profileComplete, false)
    assert.equal(status.approvalStatus, active === '1' ? 'activated' : 'pending')
    assert.equal(calls, 2)
    const result = await proxyFor(status)(request('/home'))
    assert.equal(result.kind, active === '1' ? 'next' : 'redirect')
  }
})

test('Database outages and unrelated missing columns never use legacy access', async () => {
  for (const error of [{ code: '42501', message: 'permission denied' }, { code: '42703', message: 'column users.isactive does not exist' }]) {
    let calls = 0
    const api = server({ from: () => { calls++; return profileDb(null, error).from() } })
    await assert.rejects(api.getAccountAccessByAuthId('id'), error => error.status === 503)
    assert.equal(calls, 1)
  }
})

test('Account lookup failure shows login instead of raw JSON; APIs still return 503', async () => {
  const gate = proxyFor(new Error('database unavailable'))
  assert.equal((await gate(request('/'))).body, '/login')
  assert.equal((await gate(request('/login'))).kind, 'next')
  assert.equal((await gate(request('/api/dispatch'))).status, 503)
})
