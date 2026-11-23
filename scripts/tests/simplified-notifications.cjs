/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const root = path.resolve(__dirname, '../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('notification clients load only on entry or explicit Refresh', () => {
  const center = source('components/notifications/NotificationCenter.tsx')
  const inbox = source('app/notifications/NotificationInbox.tsx')

  for (const client of [center, inbox]) {
    assert.doesNotMatch(client, /setInterval/)
    assert.doesNotMatch(client, /postgres_changes/)
    assert.doesNotMatch(client, /processPendingNotificationsRequest/)
    assert.match(client, /loading \? "Refreshing" : "Refresh"/)
    assert.match(client, /refreshInFlight/)
  }
})

test('notification rows are interactive and can open their target route', () => {
  const list = source('components/notifications/NotificationList.tsx')
  const center = source('components/notifications/NotificationCenter.tsx')
  const inbox = source('app/notifications/NotificationInbox.tsx')

  assert.match(list, /onClick=\{\(\) => onOpen\(notification\)\}/)
  assert.match(list, /cursor-pointer/)
  assert.doesNotMatch(list, /aria-disabled|\sdisabled(?:\s|>)/)
  assert.match(center, /router\.push\(notification\.target_url\)/)
  assert.match(inbox, /router\.push\(notification\.target_url\)/)
})

test('template management is in-app only and excludes unready catalog modules', () => {
  const layout = source('app/admin/notifications/Layout.tsx')
  const api = source('app/api/admin/notifications/route.ts')
  const page = source('app/admin/notifications/page.tsx')

  assert.match(layout, /Notification Templates/)
  assert.match(layout, /email_enabled: false/)
  assert.doesNotMatch(layout, /Process Health|Process due|Retry failed emails|label="Email"/)
  assert.match(api, /moduleDefinition\.ruleActivationReady === false/)
  assert.match(api, /email_enabled: false/)
  assert.match(api, /require_view_permission: true/)
  assert.doesNotMatch(api, /body\.email_enabled|body\.require_view_permission/)
  assert.match(page, /ruleActivationReady !== false/)
})

test('no notification worker or notification-email sender remains in the app source', () => {
  const removedPaths = [
    'app/api/notifications/process/route.ts',
    'lib/notifications/processEmailDeliveries.server.ts',
    'lib/notifications/emailTemplate.ts',
  ]

  for (const relativePath of removedPaths) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} should be removed`)
  }

  for (const relativePath of [
    'app/api/auth/register/route.ts',
    'app/api/auth/registration-profile/route.ts',
    'app/api/admin/createUser/route.ts',
    'app/api/admin/userActivation/route.ts',
  ]) {
    const route = source(relativePath)
    assert.doesNotMatch(route, /processPendingNotificationEvents|processPendingNotificationEmails/)
  }

  assert.match(
    source('app/api/admin/userActivation/route.ts'),
    /processTransactionalEmails/,
    'transactional account email must remain separate',
  )
})

test('deployment SQL performs immediate protected in-app dispatch without cron', () => {
  const sql = source('app/sql/new/simplify_notification_dispatch.sql')

  assert.match(sql, /create schema if not exists private/i)
  assert.match(sql, /security definer\s+set search_path = ''/i)
  assert.match(sql, /revoke all on function private\.dispatch_notification_outbox_after_insert\(\)\s+from public, anon, authenticated/i)
  assert.match(sql, /after insert on public\.notification_outbox\s+for each statement/i)
  assert.match(sql, /public\.process_notification_outbox\(200\)/i)
  assert.match(sql, /exception when others then\s+return null/i)
  assert.match(sql, /set email_enabled = false/i)
  assert.match(sql, /check \(not email_enabled\)/i)
  assert.doesNotMatch(sql, /cron\.schedule|net\.http|pg_net/i)
})
