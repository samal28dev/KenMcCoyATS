# EvalATS-main — Comprehensive API & Production Readiness Audit

**Date:** 2026-03-02  
**Scope:** All API routes, middleware, lib/, server.js  

---

## A) API Route File Status

40 route files found under `src/app/api/`. Each is evaluated for: try/catch, auth, input validation, RBAC, proper HTTP status codes.

| # | Route File | Auth | Try/Catch | Input Validation | RBAC | Status |
|---|-----------|------|-----------|-----------------|------|--------|
| 1 | `api/analytics/route.ts` (GET) | ✅ verifyAuth | ✅ | ✅ N/A (read only) | ⚠️ No role check—all authenticated users see all dashboard stats | **MINOR** |
| 2 | `api/agreements/cron/route.ts` (GET) | ⚠️ Cron secret | ✅ | ✅ | ⚠️ Localhost bypass—see (C) | **HAS_ISSUES** |
| 3 | `api/agreements/check/route.ts` (GET) | ✅ verifyAuth | ✅ | ✅ | ⚠️ Any auth'd user can trigger agreement check + notifications | **MINOR** |
| 4 | `api/auth/login/route.ts` (POST) | N/A (public) | ✅ | ✅ email+pw | N/A | **OK** |
| 5 | `api/auth/register/route.ts` (POST) | N/A (public) | ✅ | ✅ name+email+pw | ⚠️ Accepts `role` from body—any user can self-assign any role | **HAS_ISSUES** |
| 6 | `api/auth/me/route.ts` (GET) | ✅ JWT manual | ✅ | ✅ | N/A | **OK** |
| 7 | `api/auth/profile/route.ts` (PATCH) | ✅ verifyAuth | ✅ | ⚠️ Partial—no schema validation | N/A | **MINOR** |
| 8 | `api/auth/change-password/route.ts` (POST) | ✅ verifyAuth | ✅ | ✅ pw length check | N/A | **OK** |
| 9 | `api/billing/route.ts` (GET/POST/PATCH) | ✅ verifyAuth | ✅ | ✅ | ✅ Role check (admin/ops) | **OK** |
| 10 | `api/candidates/route.ts` (GET/POST) | ✅ verifyAuth | ✅ | ✅ Email regex, dupe check | ✅ getUserScope | **OK** |
| 11 | `api/candidates/[id]/route.ts` (GET/PATCH/DELETE) | ✅ verifyAuth | ✅ | ✅ Email, lock check | ⚠️ DELETE: no role check—any auth'd user can delete any candidate | **HAS_ISSUES** |
| 12 | `api/candidates/unlock/route.ts` (POST) | ✅ verifyAuth | ✅ | ✅ candidateId required | ✅ canPerformAction | **OK** |
| 13 | `api/candidate-positions/route.ts` (GET/POST/PATCH) | ✅ verifyAuth | ✅ | ✅ Status validated | ✅ Atomic lock | **OK** |
| 14 | `api/careers/route.ts` (GET) | N/A (public) | ✅ | ✅ | N/A | **OK** |
| 15 | `api/careers/[id]/route.ts` (GET) | N/A (public) | ✅ | ✅ 404+410 | N/A | **OK** |
| 16 | `api/careers/apply/route.ts` (POST) | N/A (public) | ✅ | ✅ Name, email, file size/type | N/A—but **no rate limit** | **MINOR** |
| 17 | `api/clients/route.ts` (GET/POST) | ✅ verifyAuth | ✅ | ⚠️ POST: no body validation | ✅ canPerformAction for create | **MINOR** |
| 18 | `api/clients/[id]/route.ts` (GET/PATCH/DELETE) | ✅ verifyAuth | ✅ | ✅ | ⚠️ PATCH/DELETE: no role check—any auth'd user can modify/deactivate any client | **HAS_ISSUES** |
| 19 | `api/comments/route.ts` (GET/POST/PATCH/DELETE) | ✅ verifyAuth | ✅ | ✅ Required fields | ✅ | **OK** |
| 20 | `api/config/route.ts` (GET) | ❌ No auth | ✅ | N/A | ❌ Public—exposes company config to unauthenticated users | **HAS_ISSUES** |
| 21 | `api/documents/process/route.ts` (POST) | ✅ verifyAuth | ✅ | ✅ filename required | N/A | **OK** |
| 22 | `api/emails/send/route.ts` (POST/GET) | ✅ verifyAuth | ✅ | ✅ to/subject/content | N/A | **OK** |
| 23 | `api/email-templates/route.ts` (GET/POST/PATCH/DELETE) | ✅ verifyAuth | ✅ | ✅ name/subject/content | ⚠️ No role restriction—any user can create/edit/delete templates | **MINOR** |
| 24 | `api/files/download/[storageId]/route.ts` (GET) | ✅ verifyAuth | ✅ | ✅ | N/A | **OK** |
| 25 | `api/import/route.ts` (POST) | ✅ verifyAuth | ✅ | ✅ File type check | ✅ canPerformAction | **OK** |
| 26 | `api/interviews/route.ts` (GET/POST) | ✅ verifyAuth | ✅ | ✅ Required fields | N/A | **OK** |
| 27 | `api/interviews/[id]/route.ts` (GET/PATCH/DELETE) | ✅ verifyAuth | ✅ | ✅ | ⚠️ No role check on DELETE  | **MINOR** |
| 28 | `api/notifications/route.ts` (GET/PATCH) | ✅ verifyAuth | ✅ | ✅ Scoped to user | ✅ Scoped by recipientId | **OK** |
| 29 | `api/parse-resume/route.ts` (POST/GET) | ❌ No auth on either | ✅ | ✅ File type/size | ❌ Unauthenticated users can parse resumes (costly OpenAI call) | **HAS_ISSUES** |
| 30 | `api/positions/route.ts` (GET/POST) | ✅ verifyAuth | ✅ | ✅ | ✅ canPerformAction + scope | **OK** |
| 31 | `api/positions/[id]/route.ts` (GET/PATCH/DELETE) | ✅ verifyAuth | ✅ | ✅ | ⚠️ PATCH/DELETE: no role check | **MINOR** |
| 32 | `api/reports/route.ts` (GET) | ✅ verifyAuth | ✅ | ✅ type param | ⚠️ No role restriction—any user can access all report types | **HAS_ISSUES** |
| 33 | `api/reports/export/route.ts` (GET) | ✅ verifyAuth | ✅ | ✅ | ✅ Master report restricted | **OK** |
| 34 | `api/reports/custom/route.ts` (GET/POST) | ✅ verifyAuth | ✅ | ✅ File/headers | N/A | **OK** |
| 35 | `api/socket/route.ts` (GET) | ❌ No auth | ✅ | N/A | ❌ Exposes connected client count publicly | **HAS_ISSUES** |
| 36 | `api/tasks/route.ts` (GET/POST) | ✅ verifyAuth | ✅ | ✅ | N/A | **OK** |
| 37 | `api/tasks/[id]/route.ts` (GET/PATCH/DELETE) | ✅ verifyAuth | ✅ | ✅ | ⚠️ No ownership or role check on DELETE—any user can delete any task | **HAS_ISSUES** |
| 38 | `api/teams/route.ts` (GET) | ✅ verifyAuth | ✅ | ✅ | ⚠️ Any auth'd user sees all team members (including sensitive fields like role) | **MINOR** |
| 39 | `api/upload/route.ts` (POST) | ✅ verifyAuth | ✅ | ✅ Size+type | N/A | **OK** |
| 40 | `api/users/route.ts` (GET/PATCH) | ✅ verifyAuth | ✅ | ✅ Role validation | ✅ canPerformAction + super_admin guard | **OK** |

### Summary
- **OK:** 21 routes
- **MINOR issues:** 9 routes (missing RBAC on some verbs, no schema validation)
- **HAS_ISSUES:** 10 routes (missing auth, hardcoded secret, open registration role escalation)

---

## B) TODO / FIXME / HACK / Placeholder / Dummy / Mock Instances

**No TODO, FIXME, HACK, dummy, mock, or fake data found anywhere in the source code.**

The `placeholder` matches are all legitimate HTML `placeholder` attributes on form inputs (e.g., `placeholder="Search candidates..."`) — these are normal UI behavior, not code placeholders.

---

## C) Hardcoded Credentials, Secrets, and Test Data

### 🔴 CRITICAL: Hardcoded Default Cron Secret

**File:** `src/app/api/agreements/cron/route.ts` (line 23) and `server.js` (line 18)
```typescript
const expectedSecret = process.env.CRON_SECRET || 'kmc-cron-default-secret'
```
If `CRON_SECRET` env var is not set, anyone who knows the default string can trigger the cron endpoint. Combined with the localhost bypass (lines 27-30), this is a security concern.

**Recommendation:** Remove the fallback. Fail closed if `CRON_SECRET` is not set.

### 🔴 CRITICAL: Registration Accepts Role from Request Body

**File:** `src/app/api/auth/register/route.ts` (line 12, 28)
```typescript
const { name, email, password, role } = body
const assignedRole = role || (count === 0 ? 'super_admin' : 'recruiter')
```
Any public user can register as `super_admin` or `operations_head` by passing `{ role: "super_admin" }` in the body. Only the first user should be auto-promoted; all others should be forced to `recruiter`.

**Recommendation:** Ignore `role` from body for public registration. Only allow admin-initiated role assignment via `/api/users` PATCH.

### 🟡 WARNING: JWT Token stored in non-httpOnly cookie

**File:** `src/app/api/auth/login/route.ts` (line 43)
```typescript
response.cookies.set('ats_token', token, {
    httpOnly: false, // Accessible by JS so AuthProvider can read it
```
The token is accessible to JavaScript, making it vulnerable to XSS attacks. The comment acknowledges this is intentional for the AuthProvider, but it's a security tradeoff.

### 🟡 WARNING: Socket.io CORS set to `origin: '*'`

**File:** `src/lib/socket.ts` (line 24)
```typescript
cors: { origin: '*', methods: ['GET', 'POST'] }
```
Allows any origin to connect to the WebSocket server. Should be restricted to the app's domain in production.

### ✅ OK: Other Secrets

- `JWT_SECRET`: Properly loaded from `process.env.JWT_SECRET` with fail-fast if missing
- `MONGODB_URI`: Properly loaded from env with fail-fast
- `OPENAI_API_KEY`: Properly loaded from env, graceful fallback to basic parser
- `SMTP_PASS`: Loaded from env
- Outlook password: Stored encrypted in DB per-user, masked in API responses (`'••••••••'`)

---

## D) Broken Imports / Missing Dependencies

**No broken imports detected.** All route files use consistent import paths:
- `@/lib/*` alias paths for lib utilities
- `@/models/*` for Mongoose models  
- Relative paths (`../../../lib/`) also used consistently in some files

**Potential concern:** Several routes use `require()` at runtime for optional heavy deps:
- `pdf-parse` (in parse-resume, document-processing, upload)  
- `mammoth` (in parse-resume, upload)  
- `exceljs` (in import, reports/export, reports/custom)  
- `docx` (in document-processing, upload)

These will fail silently or throw at runtime if not installed. They are listed in `package.json` so they should be fine, but this pattern bypasses TypeScript checking.

---

## E) Console.log Statements (Debug Leftovers)

### 🟡 `console.log` — Likely Debug Leftovers (should use structured logger in production)

| File | Line | Statement | Severity |
|------|------|-----------|----------|
| `src/lib/socket.ts` | 32 | `console.log('[Socket.io] Client connected: ...')` | Low — operational |
| `src/lib/socket.ts` | 38 | `console.log('[Socket.io] ... joined room ...')` | Low — operational |
| `src/lib/socket.ts` | 50 | `console.log('[Socket.io] Client disconnected: ...')` | Low — operational |
| `src/lib/socket.ts` | 54 | `console.log('[Socket.io] Server initialized')` | Low — operational |
| `src/lib/email-sender.ts` | 65 | `console.log('[Email] No SMTP configured, falling back to mailto')` | Low — operational |
| `src/lib/email-sender.ts` | 138 | `console.log('[Email] Sent successfully: ...')` | Low — operational |
| `src/lib/db.ts` | 35 | `console.log('[MongoDB] Connected successfully')` | Low — operational |
| `src/hooks/use-realtime.ts` | 94 | `console.log('[Socket.io] Connected:', socket.id)` | Medium — **client-side debug** |
| `src/hooks/use-realtime.ts` | 98 | `console.log('[Socket.io] Disconnected:', reason)` | Medium — **client-side debug** |
| `src/components/compliance-dashboard.tsx` | 94 | `console.log('Exporting compliance report...')` | Medium — **client-side debug** |
| `server.js` | 28 | `console.log('[Cron] Agreement check completed:', data)` | Low — operational |

The server-side `console.log` statements are tagged with contextual prefixes (e.g., `[Socket.io]`, `[Email]`, `[MongoDB]`, `[Cron]`), which is reasonable operational logging. However, production should use a structured logger (e.g., `pino`, `winston`) for log levels, filtering, and JSON output.

The **client-side** `console.log` in `use-realtime.ts` and `compliance-dashboard.tsx` should be removed or guarded behind `process.env.NODE_ENV !== 'production'`.

### `console.error` — All appropriate

81 `console.error` calls found. All are in `catch` blocks for error reporting. This is acceptable but would benefit from a structured logger.

---

## F) Routes Lacking Proper Auth Checks

### ❌ Completely Missing Auth

| Route | Risk | Detail |
|-------|------|--------|
| `api/config/route.ts` | Medium | Exposes company configuration (name, contact info, social links, careers branding) to unauthenticated users. If config contains internal info, this is a leak. |
| `api/socket/route.ts` | Low | Exposes WebSocket status + connected client count to unauthenticated users. Information disclosure. |
| `api/parse-resume/route.ts` (POST+GET) | **High** | Unauthenticated resume parsing. POST triggers OpenAI API calls (cost exposure). GET reveals whether OpenAI is configured. |

### ⚠️ Auth Present but Missing Authorization (RBAC)

| Route | Verb | Issue |
|-------|------|-------|
| `api/candidates/[id]` | DELETE | Any auth'd user can delete any candidate. Should require admin/ops_head role. |
| `api/clients/[id]` | PATCH, DELETE | Any auth'd user can modify or deactivate any client. Should check `canPerformAction`. |
| `api/positions/[id]` | PATCH, DELETE | Any auth'd user can update or close any position. Should use role-based check. |
| `api/tasks/[id]` | DELETE | Any auth'd user can delete any task. Should restrict to creator, assignee, or admin. |
| `api/interviews/[id]` | DELETE | Any auth'd user can cancel any interview. |
| `api/reports/` | GET | Any auth'd user can generate all report types including master report (ops_head only in export route, but unrestricted here). |
| `api/agreements/check` | GET | Any auth'd user can trigger bulk notifications to all admins. |
| `api/auth/register` | POST | Accepts `role` from body — privilege escalation. |

---

## G) Middleware Assessment (`src/middleware.ts`)

```typescript
const isPublicApiRoute = request.nextUrl.pathname.startsWith('/api/auth')
```

**Issue:** This marks ALL `/api/auth/*` routes as public, which is correct for login/register. However, `/api/auth/me`, `/api/auth/profile`, and `/api/auth/change-password` implement their own auth checks via `verifyAuth()`, so they are double-protected.

**Missing from middleware protection:**
- `/api/careers/*` — intentionally public ✅
- `/api/config` — NOT marked as public in middleware, but has no auth check in the route handler. It will be blocked by middleware for browser requests (no cookie), but API calls without cookies will get 401 from middleware. However, since middleware checks cookies and the route has no `verifyAuth()`, unauthenticated API calls with no cookie would be caught by middleware. This is inconsistent but accidentally safe for cookie-based access.
- `/api/parse-resume` — NOT marked as public, so middleware would block unauthenticated browser access. But direct API calls from authenticated front-end would work.
- `/api/socket` — Same as above.

**Key gap:** Middleware only checks for cookie presence, not JWT validity. A user with an expired or tampered cookie token passes middleware but fails at `verifyAuth()`. This means middleware provides a first defense layer but is not sufficient alone.

---

## H) server.js Assessment

| Concern | Status | Detail |
|---------|--------|--------|
| Environment detection | ✅ | `process.env.NODE_ENV !== 'production'` |
| CORS | ⚠️ | Socket.io uses `origin: '*'` — should be restricted |
| Hardcoded default secret | 🔴 | `'kmc-cron-default-secret'` fallback |
| Error handling | ✅ | Cron failures are caught and logged |
| HTTPS | ❌ | No HTTPS/TLS — relies on reverse proxy (expected for Next.js) |
| Process management | ⚠️ | No graceful shutdown handler, no cluster mode |
| Port configuration | ✅ | From env with fallback |

---

## I) Priority Remediation List

### 🔴 Critical (Fix Before Production)
1. **Remove `role` from registration body** — `api/auth/register/route.ts` line 12, 28. Ignore `body.role` for public registration.
2. **Remove hardcoded cron secret fallback** — `api/agreements/cron/route.ts` line 23 and `server.js` line 18. Fail if `CRON_SECRET` not set.
3. **Add auth to `api/parse-resume`** — OpenAI cost exposure. Add `verifyAuth()`.
4. **Restrict Socket.io CORS** — `src/lib/socket.ts` line 24. Use actual domain(s).

### 🟡 Important (Fix Soon)
5. **Add RBAC to DELETE on candidates, clients, positions, tasks, interviews** — Use `canPerformAction()`.
6. **Add role check to `/api/reports` GET** — Master report should be admin-only.
7. **Add auth to `/api/config`** and `/api/socket`.
8. **Remove client-side `console.log`** from `use-realtime.ts` and `compliance-dashboard.tsx`.
9. **Consider httpOnly cookies** + secure token handling pattern.

### 🟢 Low Priority
10. Replace `console.log/error` with structured logger (pino/winston).
11. Add request body schema validation (zod) consistently on all POST/PATCH routes.
12. Add rate limiting on public endpoints (`/api/careers/apply`, `/api/auth/login`, `/api/auth/register`).
13. Add graceful shutdown handling in `server.js`.
