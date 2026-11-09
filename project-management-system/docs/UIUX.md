# PMS interface

The frontend uses the existing Spring session, CSRF protection, roles, PostgreSQL records, and request review rules. No additional backend service or database is required.

## Workspace

- Navy navigation with desktop collapse, active routes, mobile drawer, keyboard focus trapping, Escape dismissal, and a skip link.
- Inter font files are bundled locally. The blue/slate design tokens live in `frontend/src/design-system.css`.
- Light/dark preferences and sidebar width are saved locally. Authentication stays in the existing HttpOnly session cookie.
- Header project search routes to the filtered portfolio; unread notification counts come from `/api/notifications`.
- Management actions and navigation are role aware. Existing API authorization remains authoritative.

## Portfolio

Table, grid, status board, and schedule timeline share the actual project records. Table/grid use 20 rows per page. Board/timeline include every matching project, including projects beyond the first API page.

Search, status and priority use the existing API. Engineer assignments and schedule overlap are filtered across all loaded pages. Deadline/name sorting uses the API; progress sorting uses the full returned portfolio. Archived records are separate. My Projects shows managed/assigned projects for managers and accessible assigned projects for engineers.

The status board opens project records for edits. It does not bypass the independent review required for approvals and completion. The backend's `PLANNED` status is displayed as **Not Started**; its stored value remains unchanged.

## Dashboard and finance

Eight KPI cards use the dashboard summary and project records. **Available Budget** means approved budgets minus approved expenditure, not planned budgets. Displayed financial totals use integer cents to preserve precision, including negative balances and values above JavaScript's safe integer range. Charts use numeric coordinates, with exact financial values retained for tooltips.

Status distribution, planned/actual expenditure, actual completion months, deadlines, requests, and engineer workloads are derived from existing records. Recently updated records are explicitly labelled as project updates. Historical percentage comparisons are omitted because no portfolio snapshot API exists. Completion months appear only when actual finish dates exist. Empty portfolios display empty states rather than sample metrics.

Execution requests are cached briefly and limited to six concurrent requests. This accommodates the existing per-project execution endpoint; there is no new aggregate API.

## Operations

Tasks, Labour, Materials, Budgets, Approvals, Calendar and Reports provide portfolio-wide views. Mutations link to the existing project workflow, preserving assignment validation, work-plan permission, evidence, independent reviews, completion rules and concurrency checks. Project details include section links. PDF, Excel and CSV exports use the existing endpoints.

Settings displays the configured currency/timezone and account role. Organization configuration remains managed on the server; password changes use the existing profile form.

## Verification

Local verification on 9 November 2026 passed 20 frontend tests, 40 PostgreSQL-backed backend tests, the production frontend build, JAR packaging, and all seven packaged browser workflows, including the dashboard and phone navigation checks. Backend tests and browser checks used disposable databases on port 55432. The GitHub-hosted workflow has not yet been observed running.

Run `npm.cmd test` and `npm.cmd run build` in `frontend/`. Browser coverage is in `frontend/e2e/`, including `ui.spec.ts` for dashboard totals against the API, complete board/timeline counts, navigation, themes and phone layout.

`Verify-Foundation.ps1` runs browser workflows against a fresh database on the isolated loopback PostgreSQL cluster at port 55432. It explicitly sets `SPRING_DATASOURCE_*` as well as `PMS_DB_*`, to keep browser test writes isolated from the development database. Backend regression tests should similarly use explicit `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD` targeting a disposable database.

Screenshots and runtime logs are saved under ignored `.runtime/`. New SPA routes are registered in Spring for direct navigation when packaged.
