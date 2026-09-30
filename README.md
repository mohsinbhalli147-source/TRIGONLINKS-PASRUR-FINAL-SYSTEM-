# Trigon Links ISP Management System

A fiber ISP operations suite: subscribers, connections, billing, inventory,
staff, complaints, reporting.

React 19 · Vite 8 · TypeScript · Tailwind 4 · Express · Appwrite

## Two applications, one backend

| Project | Location | Who | Stack |
| --- | --- | --- | --- |
| **Admin panel** | this repository (`src/`) | staff and administrators | desktop-first web app, 21 modules |
| **Subscriber app** | `customer-app/` | subscribers, on their phone | phone-first installable PWA |

The subscriber app is a **separate project with its own dependencies, build and
deployment**. It is not part of the admin bundle, and the admin bundle contains
no subscriber-facing code. Both talk to the **same Express server** in this
repository, so there is one database, one set of credentials and one audit trail.

```
 Admin panel  (staff)     ──┐
                            ├──▶  Express server  ──▶  Appwrite
 Subscriber app (phone)   ──┘      (this repo)         (shared database)
```

### Subscriber app

```
customer-app/
  src/
    api.ts             Client for the subscriber API. No Appwrite SDK, no token.
    auth.tsx           Session state; identity always comes from the server.
    LoginScreen.tsx    User ID + CNIC sign-in
    HomeScreen.tsx     My Account / Payments / Complaints
  android/             Capacitor project, builds a real .apk / .aab
  public/              Manifest, icons, service worker
  PLAY-STORE.md        Play Console checklist, listing copy, data-safety answers
  PRIVACY-POLICY.md    Publishable privacy policy
  android/SIGNING.md   Release keystore setup
```

Subscribers sign in with their **Trigon Links user ID plus the CNIC on file**.
Both factors must match the same record. Neither is treated as sufficient alone.

Trigon Links keeps the CNIC on the **customer record** itself, in plaintext. It
is the second factor for subscriber sign-in, so it cannot be a hash there: the
server reads `customer.cnic` to compare against the number being presented, and
staff use it for verification, search, printed slips and CSV export.

`npm run provision` **additionally** writes a PBKDF2-SHA512 hash (210,000
iterations, per-subscriber random salt) into a `subscriber_credentials`
collection whose collection permissions are deliberately **empty** — no team or
user role can read it, only the server API key can. That collection is not
where the CNIC is kept; it is the password-equivalent copy used to verify a
sign-in attempt.

What the hash collection also stores is `cnicDigits`, the plaintext digits, so a
re-run can tell whether a corrected CNIC needs re-hashing. That copy is
redundant with the customer record and is the obvious next thing to remove; see
"Known outstanding items".

Subscribers get **no Appwrite account at all**. They have no data access in
Appwrite, so a session token would grant nothing; everything they see is
assembled server-side by `GET /api/portal`, scoped to their own session. This
also means far fewer accounts in your project.

`GET /api/portal` returns an **explicit allowlist of fields** rather than the
stored record, and matches rows on `customerId` only. A subscriber therefore sees
their own records and nothing else, and a staff-only field added to a customer
document later cannot leak by default.

Changing what a subscriber signs in with means correcting the CNIC on their
customer record and re-running `npm run provision`, which re-hashes it.

**Residual risk, stated plainly:** a CNIC is printed on a national ID card, so it
is not a secret in the way a password is. Requiring the user ID *and* the CNIC
together is what makes this acceptable rather than a guessable single factor, and
subscriber sign-in is rate limited to 5 attempts per IP per 10 minutes. If you
later want a stronger factor, add a subscriber-issued password alongside the
CNIC — the credential record already has room for a second factor.

### Building the Android app

```bash
cd customer-app
npm install
npm run icons                 # generate launcher icons for every density
npm run android:aab           # -> android/app/build/outputs/bundle/release/app-release.aab
```

`npm run android:aab` builds the web bundle, copies it into the Android project
and runs Gradle.

Requirements: **JDK 21** (Capacitor's Android library is compiled with
`source release 21`; JDK 17 fails) and the Android SDK with `platform-tools`, a
`platforms;android-36` and `build-tools`. `scripts\build-android.ps1` sets
`JAVA_HOME` to a JDK 21 that actually exists, because the machine-level
`JAVA_HOME` may point at a directory that no longer exists.

Verified artefacts from a clean build:

| Artefact | Size |
| --- | --- |
| `app-debug.apk` | 4.0 MB |
| `app-release.aab` | 1.3 MB |

The release bundle requests exactly two permissions, `INTERNET` and
`ACCESS_NETWORK_STATE`, confirmed with `aapt2 dump permissions`.

For a Play Store upload, create a release keystore first — see
`customer-app/android/SIGNING.md`. Without it the bundle is signed with the debug
key and Play Console will reject it. `customer-app/PLAY-STORE.md` has the listing
copy, the data-safety answers, the graphics specs and a release checklist.

The app is permission-free apart from the network, blocks cleartext HTTP, keeps
its session in a cookie JavaScript cannot read, and excludes itself from device
backups. There is no analytics, advertising or crash-reporting SDK — keep it that
way, since adding one changes the Play data-safety declaration.

### Running both in development

```bash
# Terminal 1 - the shared backend
npm install
npm run provision
npm run dev                 # http://localhost:3000

# Terminal 2 - the subscriber app
cd customer-app
npm install
npm run dev                 # http://localhost:5174, proxies /api to :3000
```

The customer app's dev server proxies `/api` to `TRIGON_API_ORIGIN`
(default `http://localhost:3000`) so the session cookie is same-origin. In
production set `VITE_API_BASE` if the API is on a different host — and note that
a cross-origin API requires CORS plus credentialed cookies to be configured on
the server. **Same-origin deployment is simpler and preferred.**

### Installing on a phone without the Play Store

The app is an installable PWA. On Android, open the URL in Chrome and choose
**Add to Home screen** — it launches fullscreen with its own icon, portrait
locked, and caches its shell for offline use. The service worker deliberately
never caches `/api/`, so a subscriber's bills are never written to the device
cache.

---

# Admin panel

## Read this before deploying

This application handles subscriber PII (national ID numbers, phone numbers,
home addresses) and network credentials. A few things changed fundamentally in
the security rework, and **the app will not start or accept sign-ins until they
are done.**

### Required before first run

1. **Rotate the Appwrite API key.** A working server key was committed to
   version control at the old `server.ts`. Treat it as compromised. Create a new
   one in the Appwrite console (Overview → Integrations → API Keys) with access
   to Databases, Users and Teams, then delete the old one.
2. **Create `.env`** from `.env.example`. The server refuses to boot if
   `APPWRITE_API_KEY` or `SESSION_SECRET` is missing. There are no built-in
   defaults, on purpose: a committed key is indistinguishable from a rotated one.
3. **Run `npm run provision`** to create the database, collections, the staff
   team, the per-area teams, staff accounts, and subscriber CNIC hashes.
4. **Delete `provisioning-credentials.txt`** once you have distributed the
   generated staff passwords. It is gitignored; do not email it.

### What staff sign in with

Their work email plus a password an administrator issues. There is no default
password for anyone.

Subscribers do **not** get an account. They sign in to the separate customer app
with user ID + CNIC. See the section above.

---

## Setup

```bash
npm install
cp .env.example .env        # Windows: copy .env.example .env
# fill in APPWRITE_API_KEY, SESSION_SECRET, APPWRITE_PROJECT_ID, APPWRITE_DATABASE_ID
npm run provision           # one-time: schema, permissions, accounts
npm run dev                 # http://localhost:3000
```

Production:

```bash
npm run build
npm start                   # serves dist/ with security headers
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Express + Vite middleware, hot reload |
| `npm run build` | Production bundle into `dist/` |
| `npm start` | Production server (`NODE_ENV=production`) |
| `npm run provision` | Idempotent Appwrite schema/permission/account setup |
| `npm run typecheck` | `tsc --noEmit` |

---

## How access control works

The browser never decides who someone is, and it no longer decides what may be
written.

```
sign in
Browser  ──POST /api/auth/login──▶  Express
                                        │ verify password against the account system
                                        │ set httpOnly session cookie + grant cookie
                                        ▼
                                   Appwrite session returned once

reads
Browser  ──────────────────────────────▶  Appwrite
                                        direct, using the session token, read-only rows

writes
Browser  ──POST /api/data/:collection──▶  Express
                                        │ verify the signed session
                                        │ load the staff profile
                                        │ authorise role + module + function
                                        │ read the stored row, resolve its area
                                        │ compute read-only Appwrite permissions
                                        ▼
                                     Appwrite  (server API key, single writer)
```

- **Passwords are owned by Appwrite** and hashed there. They appear in no record
  the browser can read, and are not stored in this repository.
- **No `"any"` permissions exist** on any collection or row.
- **The browser has no write path into Appwrite at all.** Collections carry no
  `create` grant, and rows carry only `read(...)` grants. `permissionsForArea()`
  in `server/appwrite-rest.ts` is the single definition of those permissions and
  cannot emit an `update` or `delete` grant.
- **The server is the only writer.** Every mutation goes through
  `POST /api/data/:collection`, `POST /api/data/bulk` or
  `DELETE /api/data/:collection/:documentId`.
- **Subscribers have no Appwrite read access at all.** Their app reads from the
  server's `/api/portal` endpoint, which returns only the caller's own records.
  A subscriber cannot reach another subscriber's data even holding a valid
  session.
- **Privileged actions are administrator-only** and enforced in the handler, not
  just hidden in the UI: creating or editing staff accounts, deleting a
  subscriber, and approving a deletion request.
- **Reading a subscriber's PPPoE credentials** goes through
  `GET /api/customers/:id/credentials`, which is staff-only, rate-limited, and
  writes an audit entry every time.

### Write authorization

`server/write-authz.ts` holds the whole policy in one table, keyed by collection.
Every write is checked against the profile loaded server-side from the staff
collection, never from the request body:

- **Role.** `areas`, `staff` and `settings` are administrator-only. A subscriber
  session cannot write operational data at all.
- **Module.** The caller must hold the relevant module (`sections`). Several
  collections accept more than one, because staff reach the same record from
  different screens.
- **Function.** The fine-grained grant, e.g. `add_customers` to create a
  customer, `manage_packages` to change a package.
- **Area.** For area-scoped collections the caller must be assigned to the
  record's area. `invoices`, `payments`, `complaints` and `messages` carry no
  `areaId`, so the server resolves it from the record's `customerId`. A record
  that resolves to no area is administrator-only rather than open to everyone.
- **Stored state, not claimed state.** For an update or a delete the server
  reads the existing document first and authorises against *that*, so editing
  `areaId` or `customerId` in the request body cannot move a record into an area
  the caller happens to own. Moving a record between areas is administrator-only.
- **Audit integrity.** Activity log entries are stamped with the session's user,
  never with whatever the client sent.

`npm run verify:write-authz` runs all of this against the live project, including
an adversarial section that audits the permissions of rows that already existed.

### Sign-in on Appwrite 2.x

`POST /account/sessions/token`, which this project used to call with an email and
password, no longer accepts one. On 2.x that route is only for the magic-URL and
OTP flows and needs `userId` + `secret`, so every sign-in failed with:

```
Param "userId" is not optional.
```

`server/appwrite-rest.ts` now uses the supported two-step flow:

1. `POST /account/sessions/email` with the email and password. This is what
   proves the password. It answers with the session **cookie**
   (`a_session_<project>=<value>`), not with a token.
2. `POST /account/jwt` replaying that cookie. This returns the **15 minute JWT**
   the browser actually uses.

The two are not interchangeable, and the split is the point: step 1 is a
credential check, step 2 is a read token.

Because the JWT is short lived, the long-lived session has to live somewhere. It
lives in the signed `httpOnly` `trigon_grant` cookie, which never reaches
JavaScript. From it the server mints a fresh JWT on demand:

- `GET /api/auth/session` — after a reload, always mints a new JWT, because the
  sign-in one has expired while the tab was shut.
- `POST /api/auth/refresh` — for a panel left open. `AuthContext` calls it every
  10 minutes and again on `visibilitychange`, which covers a laptop that slept
  past the expiry.

Both need no password: the grant cookie is the credential, and Appwrite only
re-checks the session it already issued.

`npm run verify:auth` drives this end to end against a throwaway staff account:
sign in, use the JWT for a real Appwrite read, reload, refresh, write through the
server, and sign out. It needs the server running (`npm run dev`).

**Known limitation.** Appwrite 2.x JWTs are stateless, so signing out revokes the
session but does **not** invalidate a JWT that was already issued: it stays valid
for up to 15 minutes. The exposure is bounded and read-only, because every write
requires the server and the server refuses the session immediately. Closing the
window entirely means proxying reads, below.

### Known issue: the session token is still exposed to JavaScript

The sign-in response includes the Appwrite JWT in its JSON body, and `AuthContext`
passes it to `AppwriteService` for direct reads. The `httpOnly` cookie protects
the app's own session, but it does not hide this second value from anyone with
devtools open.

This is far less serious than it was before the 2.x migration above: the value is
now a 15 minute, read-only JWT rather than a long-lived session token, and the
long-lived session cookie stays on the server. The remaining fix is to stop
sending it at all:

- Proxy reads through the server (`GET /api/data/...`) so the Appwrite credential
  never leaves the backend. This also removes the 15 minute post-logout window
  above, because the server can then check the session on every request.
- Rotate `SESSION_SECRET` when this lands, since a token that was exposed cannot
  be un-exposed.

### Appwrite labels

Appwrite 2.3 accepts only `[A-Za-z0-9]`, at most 36 characters, in a label. The
`:` separator, `-` and `_` are all rejected, so `role:Admin` and
`entity:staff-1790402026962` both fail with `Invalid labels param`, and every
provisioning run aborted partway. The role is now stored as one glued token
(`roleadmin`, `rolestaff`, `rolecustomer`) and ids are left out entirely, since
nothing read them: `resolveStaffProfile` finds the staff record from
`claims.entityId`, not from a label.

### Rate limiting

Sign-in is limited to 10 attempts per IP per 5 minutes. **Subscriber sign-in is
tighter: 5 attempts per IP per 10 minutes**, because each attempt also costs a
PBKDF2 derivation and the user ID + CNIC pair is the only thing protecting the
account. Password resets are limited to 20 per administrator per hour, and
credential reads to 120 per staff member per hour. The limiter is in-process; put
Redis behind it before running multiple instances.

### Area scoping is enforced by Appwrite

A technician should only see the areas they are assigned to. This is a real
boundary, not a client-side filter:

- `npm run provision` creates one team per service area (`area_<areaId>`), plus
  `trigon_admin` and `trigon_staff`.
- Staff are added to the teams for their assigned areas. **Administrators are
  added to every area team.** Team membership requires the server API key, so a
  client cannot grant itself access to another area.
- Every collection is `read("team:trigon_admin")` with document security on and
  **no `create` grant**, so a browser cannot invent a row. Staff **read through
  per-document permissions**, not through the collection.
- Each record carries permissions naming the admin team and its own area team,
  and **only read grants**. The server computes them on every write;
  `npm run provision` backfills them onto existing rows, which would otherwise
  be invisible to everyone or, worse, still carry the old `update`/`delete`
  grants.

A staff member therefore cannot read a record in an area they are not assigned to,
even with a valid session token and devtools open. The `src/utils/scoping.ts`
helpers are defence in depth on top of this.

The `staff` collection is admin-only, since it holds each colleague's role and
permission grants.

**Read scope and write scope are now the same boundary.** Writes are authorised
server-side per area, so a technician cannot write into an area they cannot see.
Note that a staff member with **no assigned areas** can write nothing
area-scoped. That is fail-closed on purpose, and it is consistent with what
Appwrite already enforced on reads, but it is stricter than
`src/utils/scoping.ts`, which treats an empty area list as "unrestricted". Areas
must therefore be assigned for a staff account to be useful; check this when
granting a role.

### Opting into per-row ACLs requires the provision script

Existing deployments must run `npm run provision` again after upgrading. It is
idempotent, and it is what applies the new collection permissions and backfills
row-level access. **Until it is run, rows created before this change still carry
`update("team:trigon_admin")` and `update("team:area_<id>")` grants, and a staff
member in that area team can still write to them directly from the browser,
bypassing the server entirely.** `npm run verify:write-authz` reports this
specifically.


---

## Data handling

- The browser keeps a `localStorage` cache for speed. **Credential fields
  (`password`, `pppoePassword`) are stripped before anything is written to it.**
  Failed uploads are queued in `trigon_pending_writes` and retried, so a dropped
  request is no longer lost.
- **Google Drive backups are an explicit administrator action** and no longer run
  automatically on sign-in. The OAuth scopes were reduced: the app requested
  `https://mail.google.com/` (entire mailbox) and now requests only
  `gmail.send`, `contacts` and `drive.file`.
- Before enabling the Google integration, restrict the Firebase API key in
  `firebase-applet-config.json` by HTTP referrer and lock the OAuth client to
  your authorised origins.

### Area scoping

Enforced in Appwrite — see "Area scoping is enforced by Appwrite" above.
`src/utils/scoping.ts` only narrows the default view on top of that.

---

## Layout

```
server.ts              Express: auth API, subscriber portal, static/Vite
server/
  config.ts            Env loading. Every secret required, no defaults.
  auth.ts              Session signing, identity resolution, rate limiting
  appwrite-rest.ts     Server-side Appwrite REST client (holds the API key)
scripts/
  provision-appwrite.ts  One-time schema, permissions, account migration
src/
  services/
    authApi.ts         Browser client for the auth API
    appwrite.ts        Staff data access via the Appwrite Web SDK
    storage.ts         Local cache, sync engine, all CRUD
    autoSync.ts        Background safety-net sync
    googleWorkspace.ts Optional Google integration
  context/AuthContext.tsx   Session state; no identity in web storage
  components/common/Modal.tsx  Dialog with Escape, focus trap, ARIA
  hooks/useStorageCollection.ts Replaces 14 copies of sync boilerplate
  utils/csv.ts         Injection-safe CSV export
  utils/scoping.ts     Area scoping
```

### Sync behaviour

`initRealtimeSync()` is **polling, not a realtime subscription** — despite the
old comment. It polls every 20 s, pauses when the tab is hidden, refuses to
overlap with itself, and returns a teardown function that is called on sign-out.
The previous version started an unstoppable 5 s timer that survived logout, and
silently swallowed every error.

Monthly bill generation, invoice de-duplication and expired-request purging were
previously performed *inside getters* — meaning simply rendering a list wrote to
storage and issued server-side DELETEs. They are now explicit methods called from
the sync cycle.

---

## Verification scripts

```bash
npx tsx scripts/verify-credential-crypto.ts      # PBKDF2 hash/verify behaviour
npx tsx scripts/verify-subscriber-auth.ts        # subscriber sign-in error handling
npm run verify:write-authz                       # C-2 write authorization, end to end
npm run verify:auth                              # Appwrite 2.x sign-in, refresh and sign-out
npm run verify:cleanup-fixtures                  # remove rows an aborted run left behind
npm run verify:password                          # provisioned passwords: shape and randomness
npm run verify:sw                                # service worker: precache and bypass rules
```

The second one reports the happy path as **skipped** until `npm run provision`
has run against a project that actually contains subscriber records.

`verify:write-authz` runs against the live project. It creates its own throwaway
staff accounts and `verify-c2-` rows, uses real area teams so the permission
checks are genuinely adversarial, and deletes everything it created. Cleanup is
wired to the failure paths as well as the happy one, so a run that throws partway
through does not leave rows in the database; `verify:cleanup-fixtures` mops up
after an earlier one that predates that. Every test prints PASS or FAIL and the
exit code is non-zero on any failure, so it can gate a deploy. Its final section
audits the permissions of rows that already existed, which is the only way to tell
whether `npm run provision` has actually been run.

`verify:auth` needs the server running (`npm run dev`) and exercises the whole
session chain against a throwaway staff account, ending with a write through
`/api/data/...` and the same write attempted directly against Appwrite. Sign-in is
rate limited to 10 attempts per IP per 5 minutes and the probe always runs from
`127.0.0.1`, so running it twice inside five minutes reports **skipped** with exit
code 0 rather than failing on the limiter. Wait for the window to reset first.

`verify:password` checks that a provisioned password still matches
`Tg-XXXX-XXXXXX-XXXXXX`, uses no ambiguous characters, and is drawn without modulo
bias. It measures the per-character spread over 4.8 million characters, because
the bias it guards against is a ~25% skew that is invisible in a handful of draws.

`verify:sw` runs the real service worker against a fake worker scope, so the
precache, the offline fallback and the request-bypass rules are asserted rather
than assumed. It is what caught the original worker resolving an offline
navigation to `undefined`.

## Known outstanding items

- **`customer-app/PRIVACY-POLICY.md` still overstates the protection.** It says
  "We store a one-way salted hash of it, not the number itself, so a copy of our
  database cannot be used to reconstruct identity numbers." The hash is real, but
  it is not the only copy: the CNIC is also held in plaintext on the customer
  record, because it is the second sign-in factor and staff verify against it.
  The subscriber-facing text needs to be corrected to say the number is retained
  for identity verification and is visible to authorised staff, rather than
  claiming it is never stored. The README wording is now accurate; the customer
  app's is not, and it is the one subscribers actually read.
- `subscriber_credentials.cnicDigits` is redundant with the customer record and
  exists only so a re-run can detect a corrected CNIC. Dropping it means deriving
  "did this change" from the customer record instead, and re-hashing whenever the
  stored hash does not verify - slower, but it removes a plaintext copy from the
  one collection that is otherwise server-only. Not done; it needs a migration.
- The sign-in response still returns a 15 minute Appwrite JWT to JavaScript, and
  Appwrite's stateless JWTs mean a signed-out token stays readable for up to 15
  minutes. Both close together, by proxying reads through the server. See "Sign-in
  on Appwrite 2.x" above.
- A staff account with **no assigned areas** can write nothing area-scoped. Check
  that areas are assigned when granting a role. Three of the six real accounts
  (`staff-support`, `staff-1790400279196`, `staff-1790403523522`) currently have
  none, so they cannot create or edit customers, invoices, payments or expenses.
- The subscriber app is a PWA, not a Play Store APK. Wrapping the built bundle
  with Capacitor is the remaining step if you need one.
- CSV exports and Google Drive backups contain subscriber PII (national ID,
  address). Backups are administrator-initiated and credential-free, but the data
  itself is still unencrypted at rest in the operator's Drive.
- Roughly 160 form labels were paired with their controls and icon-only buttons
  labelled. A screen-reader pass with a real screen reader is still worthwhile.
- `firebase-applet-config.json` still contains a Firebase web API key. It is
  designed to be public, but restrict it by HTTP referrer and lock the OAuth
  client to your authorised origins.
- The `firebase` package is still a dependency. It is now loaded on demand by
  `googleWorkspace.ts` rather than at first paint, so it no longer costs anything
  on sign-in, but removing the dependency entirely is still a task if the Google
  integration is not wanted.


