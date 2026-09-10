# Network and client-error review — 2026-09-10

The supplied stack trace is a rejected User Management request followed by an uncaught promise rejection in `handleReset`. Its message originates in the administrative access guard. It is not sufficient evidence of a lost internet connection or a Netlify outage. The existing guard also incorrectly converted failed database profile lookups into permission denials, so the actual deployed cause requires the HTTP status and server logs.

## Scope and evidence

- Static inventory of 560 TypeScript/TSX files under `app`, `lib`, and `components`, excluding the repository's restricted legacy areas. The AST scan found 664 `.from` calls and 61 `.rpc` calls; these are syntactic inventory counts, not individual live query tests.
- Inspected central Supabase clients, admin and notification authorization, registration, HTTP repositories, initial list loaders, offline banner handling, route configuration, and the supplied stack trace.
- No authenticated production requests, database changes, provider email tests, or Netlify deployment were performed. The site URL, deployed environment, adapter version, and function logs were not supplied at review time.

## Fixed

| Finding | Change |
| --- | --- |
| User Management's initial load/Refresh rejects without a catch | Show the actual failure in a toast and clear loading state; remove unused duplicate loaders. Existing access restrictions remain in place. |
| Admin profile-query failures become `FORBIDDEN` | Separate missing/unauthorized users from database failures. Auth service outages return 503, actual missing authentication returns 401, and actual denied roles return 403. Apply the same distinction to notification auth and permission target lookup; registration token verification also distinguishes outages. |
| API clients assume every response is JSON | Shared `readJsonResponse` preserves backend error messages and HTTP status, and handles HTML/text proxy errors without displaying raw response bodies. Body-stream network failures retain their original rejection. |
| Connectivity notices cover Supabase but not shared app API clients | Reuse `fetchWithInternetErrorNotice` in user, permission, activation, notification, registration, farm, item import, item group, and timeline SQL clients. Request options, bearer tokens, abort signals, and bodies remain unchanged. There are no automatic write retries. |
| Offline detection labels every error as connectivity-related when `navigator.onLine` is false | Classify errors by their actual type/message/status. HTTP permission errors and intentional cancellation do not become offline errors. Circular error objects cannot crash the classifier. The existing 60-second banner delay and browser offline/online events remain. |
| Similar unhandled initial-load failures | Add catches to DOC Placement, Goods Receipt, Inventory Transfer, and warehouse farm-option loading. Existing rows are retained on failed refresh. |
| Approved user's permissions require another manual selection | Successful activation navigates using the persisted response's Auth ID. User Permissions selects it only if it appears in the existing manageable-user response; an unavailable target stays unselected instead of silently opening another user's permissions. |

## Remaining verification and observations

- Confirm the affected actor's persisted `user_type` and permitted scope when investigating a remaining 403. Do not bypass role checks to make the error disappear.
- Some legacy route-local HTTP calls and the external dispatch/email provider paths remain outside the shared response parser. The central Supabase transport covers the existing client queries, but this does not prove every screen handles every asynchronous failure. The scan also found try/finally-only blocks whose nested or caller-level error handling must be considered individually.
- `GETAuthUsers` is an unused legacy helper that attempts to construct an admin client from a server environment variable in a client-imported module. Its unused page callback was removed. It is not the supplied stack trace's execution path.
- `_middleware.ts` and the unused `updateSession` utility are not evidence of an active session-refresh middleware. The current API flows explicitly use bearer tokens and the browser Supabase client. No middleware was enabled as part of this review.
- Check deployed Supabase URL/key presence and project consistency through Netlify settings without copying secrets into logs. The checked-in repository has no Netlify config proving those deployment values.
- If failures correlate with deployments and missing JavaScript assets, inspect deployment skew separately. Netlify documents opt-in `NETLIFY_NEXT_SKEW_PROTECTION=true`; explicit client fetches have additional limitations. This is a diagnostic possibility, not an established cause of this incident. [Netlify Next.js support and skew protection](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).
- Expected request failures should be handled where the asynchronous action runs; render error boundaries do not replace those catches. [Next.js error handling](https://nextjs.org/docs/app/getting-started/error-handling).

## Validation

`node --test scripts/tests/network-errors.cjs` runs eight regression tests against the actual TypeScript network and administrative access modules with mocked transports. Tests cover HTTP status/message preservation, HTML/invalid JSON, cancellation, response-stream failure, circular errors, offline classification, request options, no retries on writes, and the distinction between auth, role, database, and connectivity failures.

TypeScript and focused ESLint checks are also run on the changed application files. These checks do not establish live Netlify/Supabase connectivity or authenticated browser behavior.
