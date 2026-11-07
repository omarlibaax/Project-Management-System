# Verification history
Verified on 7 November 2026, Africa/Nairobi:
- Backend: Maven test/package succeeded; 9 PostgreSQL-backed integration tests, 0 failures.
- Frontend: 5 Vitest tests passed; TypeScript and Vite production build succeeded.
- Browser: 2 Playwright tests passed in Microsoft Edge against real Spring/PostgreSQL.
- Runtime: backend and Vite proxy health returned UP; Flyway applied and validated V1.
- Browser confirmed admin/engineer login, API role checks, HttpOnly/SameSite=Lax cookies,
  no localStorage authentication, missing-CSRF rejection, logout and phone navigation.
- Inspected desktop screenshot and generated mobile screenshot in ignored .runtime.
- npm dependency installation reported 0 vulnerabilities.
- Vite reports a non-blocking 510 kB main-chunk warning (162 kB gzipped).
  Route splitting can be introduced as additional feature modules arrive.
- Initial checks found and corrected Spring's factor-authority role comparison,
  TypeScript 7 baseUrl removal, and React Query logout observer invalidation.
- The browser harness launches the JDK directly to avoid orphaning the Windows Java shim child.
Application processes and the isolated test database were stopped after verification.
The owner's running PostgreSQL service and records were not modified.

## Manual walkthrough
1. Start PostgreSQL, backend (dev profile), and frontend using README.
2. Visit /actuator/health on backend port 8080: status UP.
3. Open http://127.0.0.1:5173; unauthenticated users see login.
4. Sign in with the configured admin account; verify your name and SUPER_ADMIN role.
5. Sign out and sign in with the engineer account; verify ENGINEER role.
6. Inspect browser storage: JSESSIONID is HttpOnly; no tokens in localStorage.
7. In browser network tools, POST without a CSRF header returns 403.
8. Engineer session GET /api/admin/access-check returns 403; admin returns 200.
9. Change your password from My profile; sign in with the replacement password.
10. Submit five incorrect passwords; further login attempts are rejected for 15 minutes.
11. In a development database only, set an account active=false; its next API request returns 401.
12. At phone width, verify navigation toggle, readable forms, and sign-out action.

## Integration tests
PmsApplicationTests connects to the PostgreSQL database specified in PMS_DB_URL.
It inserts isolated uniquely named accounts and verifies health, authentication, CSRF,
role authorization, suspension, lockout, logout and password changes.
Always run against a disposable database; never production. Tests retain records for inspection.

## Deployment checks before later production use
Use HTTPS with Secure cookies; disable dev profile/seeding; restrict DB permissions.
Complete resource-level authorization and workflows as their modules are implemented.
Review browser accessibility and full user workflows after all modules are available.
## Reproduce isolated PostgreSQL verification on this workstation
From the repository root, initialize only if .runtime/postgres-test does not exist:
```powershell
New-Item -ItemType Directory -Force .runtime
& 'C:\Program Files\PostgreSQL\18\bin\initdb.exe' -D .runtime/postgres-test -U pms_test --auth=trust --encoding=UTF8 --no-locale
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D .runtime/postgres-test -l .runtime/postgres-test.log -o '-h 127.0.0.1 -p 55432' -w start
# Create once:
& 'C:\Program Files\PostgreSQL\18\bin\createdb.exe' -h 127.0.0.1 -p 55432 -U pms_test project_management_test
$env:PMS_DB_URL = 'jdbc:postgresql://127.0.0.1:55432/project_management_test'
$env:PMS_DB_USERNAME = 'pms_test'
$env:PMS_DB_PASSWORD = ''
$env:SPRING_PROFILES_ACTIVE = 'test'
Push-Location backend
.\mvnw.cmd -B -ntp test package
Pop-Location
.\scripts\Verify-Foundation.ps1
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D .runtime/postgres-test -m fast -w stop
```
The trust-authenticated cluster is temporary, loopback-only, and contains test data.
Never use trust authentication for production or expose this cluster to a network.
Verify-Foundation creates a fresh randomly named database and random development passwords
for each browser run. It requires Edge and the built backend jar; it stops its own
application processes in finally and restores the caller's environment.
Override -JavaExecutable and -PostgresBin if installed elsewhere.

## Phase 2 verified results - 7 November 2026

- Backend: 24 tests passed (15 PhaseTwoTests + 9 authentication tests), 0 failures/errors.
- PostgreSQL integration tests validate unique codes, date/manager/completion rules, engineer restrictions, archived-record retention, schedule history, optimistic conflicts, audited account lifecycle, role-change invalidation, 55-project pagination/aggregation, and idempotent development seeding.
- The exact monetary test stores and aggregates 9007199254740993.01 without rounding.
- Frontend: 12 tests passed across 3 files; invalid dates/budgets, required fields, filtering, protected routes, loading/errors, and exact currency display.
- Browser: 4 workflows passed in Microsoft Edge using the real backend and a fresh PostgreSQL database seeded with 55 projects. User creation/edit/suspend/reactivate, blocked suspended login, engineer directory, project creation/edit/history/filter/archive, cookies/CSRF, logout, and mobile navigation were exercised.
- Both production builds passed. Lazy-loaded pages removed the previous chunk-size warning.
- Inspected .runtime/workspace-desktop.png showing the database-backed 55-project dashboard.
- Test harness stops its own app processes. The ordinary development app is restarted separately for continued use.

Run the same commands above. Verify-Foundation.ps1 now runs all Phase 1 and Phase 2 browser tests, with PMS_SEED_PROJECTS enabled only in its disposable database. Normal development seeding remains disabled unless requested. Manual test steps and remaining feature boundaries are in PHASE_2.md.

Live development handoff: V2 applied successfully to the existing project_management_db. The original accounts and changed administrator password were retained. Backend health returned UP through the Vite proxy, the frontend returned HTTP 200, and the existing engineer account could read workspace metadata while its project list remained empty. Administrator workflows were verified separately by the four browser tests with fresh test accounts.
