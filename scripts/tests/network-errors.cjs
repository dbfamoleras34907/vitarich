const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { test } = require('node:test')

const root = path.resolve(__dirname, '../..')
function load(relative, mocks = {}, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports, Error, Response, console,
    require(name) {
      if (name in mocks) return mocks[name]
      throw new Error(`Unexpected dependency: ${name}`)
    }, ...globals,
  }, { filename: relative })
  return module.exports
}
const network = load('lib/networkError.ts', {}, { navigator: { onLine: false } })

test('offline state does not turn permission, database, or cancellation errors into internet errors', () => {
  for (const error of [new Error('You are not allowed to perform this action.'),
    { message: 'permission denied', code: '42501' },
    { message: 'fetch failed', status: 403 },
    { name: 'AbortError', message: 'network request cancelled' },
    { code: 'ERR_CANCELED' }]) assert.equal(network.isInternetError(error), false)
})

test('network failures are recognized without unsafe object serialization', () => {
  for (const error of [new TypeError('Failed to fetch'), { message: 'fetch failed' },
    { code: 'ERR_NETWORK' }, { code: 'ECONNRESET' }, new Error(network.INTERNET_ERROR_MESSAGE)]) {
    assert.equal(network.isInternetError(error), true)
  }
  const circular = {}; circular.self = circular
  assert.equal(network.isInternetError(circular), false)
  assert.equal(network.isServiceUnavailableError({ status: 503 }), true)
  assert.equal(network.isServiceUnavailableError({ status: 401 }), false)
})

function transport(fetch) {
  const notices = []
  return {
    notices,
    ...load('lib/network/http.ts', { '../networkError': {
      ...network,
      notifyInternetError(error) { if (network.isInternetError(error)) notices.push('offline') },
      notifyInternetRestored() { notices.push('restored') },
    } }, { fetch }),
  }
}

test('successful JSON remains intact and HTTP errors retain status and backend message', async () => {
  const http = transport()
  assert.equal((await http.readJsonResponse(Response.json({ success: true }))).success, true)
  await assert.rejects(http.readJsonResponse(Response.json({ error: 'Permission denied' }, { status: 403 })),
    error => error.status === 403 && error.message === 'Permission denied')
})

test('HTML proxy errors and malformed success bodies produce actionable messages', async () => {
  const http = transport()
  await assert.rejects(http.readJsonResponse(new Response('<html>private proxy details</html>', { status: 502 })),
    error => error.status === 502 && error.message.includes('HTTP 502') && !error.message.includes('private'))
  for (const body of ['<html>login</html>', 'null', '42']) {
    await assert.rejects(http.readJsonResponse(new Response(body)), /invalid response/)
  }
})

test('write failures preserve original rejection and never retry', async () => {
  let attempts = 0
  const original = new TypeError('Failed to fetch')
  const init = { method: 'POST', headers: { Authorization: 'test-token' }, body: 'test-body' }
  const http = transport(async (url, options) => {
    attempts++
    assert.equal(url, '/api/test')
    assert.equal(options, init)
    throw original
  })
  await assert.rejects(http.fetchWithInternetErrorNotice('/api/test', init), error => error === original)
  assert.equal(attempts, 1)
  assert.deepEqual(http.notices, ['offline'])
})

test('HTTP responses cancel pending connectivity warnings; cancellation does not start one', async () => {
  const response = new Response('', { status: 403 })
  const http = transport(async () => response)
  assert.equal(await http.fetchWithInternetErrorNotice('/api/test'), response)
  assert.deepEqual(http.notices, ['restored'])
  const abort = new Error('Cancelled'); abort.name = 'AbortError'
  const cancelled = transport(async () => { throw abort })
  await assert.rejects(cancelled.fetchWithInternetErrorNotice('/api/test'), error => error === abort)
  assert.deepEqual(cancelled.notices, [])
})

test('response body transport failures are not converted to JSON syntax errors', async () => {
  const http = transport()
  const original = new TypeError('Failed to fetch')
  await assert.rejects(http.readJsonResponse({ ok: true, status: 200, json: async () => { throw original } }),
    error => error === original)
  assert.deepEqual(http.notices, ['offline'])
})

test('admin access distinguishes temporary outages, query failures, and actual denied roles', async () => {
  async function check(authError, profile, queryError) {
    const query = { select() { return this }, eq() { return this }, async maybeSingle() { return { data: profile, error: queryError } } }
    const access = load('lib/auth/adminAccess.ts', {
      '@/lib/networkError': network,
      '@/lib/Supabase/supabaseAdmin': { admin_db: {
        auth: { async getUser() { return { data: { user: { id: 'test-user' } }, error: authError } } },
        from() { return query },
      } },
    })
    try { return await access.requireAdminActor(new Request('https://example.test', { headers: { Authorization: 'Bearer test' } })) }
    catch (error) { return access.adminAccessError(error) }
  }
  assert.equal((await check({ name: 'AuthRetryableFetchError', status: 503 })).status, 503)
  assert.equal((await check({ status: 401 })).status, 401)
  assert.equal((await check(null, null, { message: 'fetch failed' })).status, 503)
  assert.equal((await check(null, null, { code: '42703', message: 'column missing' })).status, 500)
  assert.equal((await check(null, null)).status, 403)
  assert.equal((await check(null, { user_type: 3 })).status, 403)
  assert.equal((await check(null, { user_type: 1 })).user_type, 1)
})
