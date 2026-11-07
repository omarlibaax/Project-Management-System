# Phase 2: users and projects

## How the pieces fit

V2__users_and_projects.sql adds projects, a unique code sequence, original schedule fields,
schedule history, indexes, checks, and optimistic versions. Flyway upgrades the existing
database without replacing Phase 1 identities. Never edit an applied migration to change
a database: add the next numbered migration instead.

UserController and ProjectController validate HTTP input and call services. UserService
owns account permissions and auditing. ProjectService owns dates, manager validation,
schedule history, status rules, and archival. DTOs prevent passwords or arbitrary entity
properties from leaking through the API. CurrentActor resolves the signed-in database
account; request bodies cannot choose the author of a change.

Project updates send the version from the last read. Hibernate checks it again when
writing. If another person saved first, HTTP 409 asks you to reload. Schedule history,
the project change, and its audit entry share a transaction, so they succeed together.

The frontend pages are in src/pages: Dashboard.tsx, Projects.tsx, and Users.tsx. They
fetch real API data with React Query and invalidate affected lists after writes.
React Hook Form and Zod validate forms before submission; the server validates again.
Feature pages load on navigation to keep the initial bundle smaller.

## Running

Use the existing README setup. Keep your database environment variables configured,
run the backend with the dev profile, and run npm.cmd run dev in frontend.
The frontend is http://127.0.0.1:5173 and proxies /api to backend port 8080.
After a backend restart you must sign in again because sessions are in memory.
On Windows, stop the running backend before packaging its jar; Windows locks open jars.

For an optional sample portfolio in an EMPTY development project table:

```powershell
$env:PMS_SEED_PROJECTS = 'true'
# Also configure the existing PMS_SEED_ADMIN_EMAIL and seed account variables from README.
# Then start the backend with SPRING_PROFILES_ACTIVE=dev.
```

This inserts 55 explicitly documented sample projects into PostgreSQL once. An existing
project table is left intact. It does not create assignments, tasks, approvals, or expenses.
Do not enable development seeding in production.

## Manual walkthrough

1. Sign in as SUPER_ADMIN. Open Users, create an ENGINEER with a unique employee code,
   valid email, and 12-64 character initial password. Add a department if needed.
2. Edit the account's name, contact, position, department, or roles. Suspend it and verify
   that login is rejected; reactivate it. Your own suspension/role removal is blocked.
3. Open Engineers and search/filter the directory. ADMIN can view it but cannot administer users.
4. Open All projects and Create project. Select an active ADMIN or SUPER_ADMIN manager.
   Enter valid dates and a non-negative budget. The backend generates a unique project code.
5. Open the project, edit its dates, and provide a schedule change reason. Verify the
   original end date and schedule history remain visible.
6. Set IN_PROGRESS and verify actual start is recorded. A past deadline shows DELAYED
   while the project status remains IN_PROGRESS.
7. Filter by status or priority and search by name, code, or location. Test pagination.
8. Archive a project, confirm it disappears from the active list, and find it using Archived.
9. Return to Overview. KPI totals and status distribution should match the active portfolio.
10. Sign in as ENGINEER. No unassigned project details, manager dashboard, user administration,
    or engineer directory should be accessible, including direct API calls.

## KPI definitions

- Total: all non-archived projects, including cancelled projects.
- Per-status totals partition Total across the six statuses.
- Delayed: non-archived, non-completed, non-cancelled projects whose effective deadline
  is before today's date in PMS_TIMEZONE. It overlaps statuses and priority totals.
- High priority: all non-archived projects with HIGH priority.
- Planned budget and actual expenditure: separate sums across the same non-archived portfolio.
  Actual expenditure remains zero until the finance module records expenses.
- Deadline is revised_end_date when present, otherwise planned_end_date.
- Duration includes both endpoints: a same-day project is one day.
- AHEAD_OF_SCHEDULE and AT_RISK are reserved for later progress/scheduling calculations.

Money is sent as decimal strings and rendered without converting to floating-point.
Neither the browser nor the API can write approved budget, expenditure, or progress
through a project form. Later modules will own those values.
