# Implementation status

V4 closes the gaps identified against the owner's requirements: permission-to-proceed work plans, task-linked labor/material budgets and reports, audited plan revisions, mandatory completion photos and resource matching, separate delay explanations, and ahead/at-risk indicators. See REQUIREMENTS_REVIEW.md for the current requirement mapping. Existing unfinished work requires a new work-plan approval before further progress/completion.

The local application now includes project execution workflows. Phases 1 and 2 are described below; Phases 3–7 are covered in EXECUTION.md and DEPLOYMENT.md.

## Phase 1 - completed and verified
- Java 21, Spring Boot 4.1.2, Maven wrapper, PostgreSQL, and Flyway.
- Session-cookie login/logout, BCrypt, CSRF, backend roles, and current-user DTO.
- Account lockout, password change, immediate suspension/role-change checks, and audit records.
- Development-only configurable seed accounts; no production credentials or public registration.
- Responsive React/TypeScript application, Axios, React Query, React Hook Form, Zod, Tailwind, and reusable controls.

## Phase 2 - completed and verified
- Super-administrator user creation/editing, multiple roles, suspension/reactivation.
- Searchable, paginated user administration and engineer directory.
- Department creation, contact information, position, and last-login metadata.
- Project creation, details, editing, archival, search, filters, sorting, and pagination.
- Unique generated project codes and validated active project managers.
- Planned dates, inclusive duration, actual start, status, and priority.
- Original schedule preservation and authorized schedule-change history.
- Optimistic version checks reject stale user/project edits with HTTP 409.
- Live portfolio KPIs and status distribution from PostgreSQL aggregates.
- Accurate decimal budget input, NUMERIC/BigDecimal storage, and string-valued monetary API responses.
- Read-time overdue condition uses the organization's timezone, separately from status.
- Optional dev-only, idempotent 55-project seed; disabled by default.
- Lazy-loaded feature pages; the previous production chunk-size warning is resolved.
- Backend: 24 integration tests passed, including 55-project aggregation and seed idempotency.
- Frontend: 12 tests passed. Browser: 4 workflows passed. Both production builds passed. See TESTING.md.

## Execution modules implemented
3. Historical engineer assignments and revocation, task creation/transfers, and weighted approved progress.
4. Labor/material plans and usage totals, quantity variance and estimated usage costs, independently approved budgets/revisions, and expense ledger.
5. Authenticated evidence storage, progress approvals, and transactional completion submission/approval/rejection.
6. Hourly deduplicated overdue notifications, engineer explanations and approved deadline extensions, interactive task progress chart, PDF/Excel/CSV exports.
7. PostgreSQL integration tests, browser workflow verification, single-JAR packaging, and deployment/operations guide. Production hosting and traffic-specific load tests require the target environment.

## Current boundaries
- GitHub Actions now defines frontend tests/build, PostgreSQL-backed backend verification, and a downloadable release JAR. Hosted workflow execution is confirmed separately from local verification.
- User administration is SUPER_ADMIN only. ADMIN can manage projects and view the engineer directory.
- Engineers see only actively assigned projects, including history, execution, evidence, and reports. Revocation immediately removes access. Transfer unfinished tasks before revoking an engineer.
- COMPLETED and PENDING_APPROVAL cannot be set through ordinary project create/edit requests.
- Progress, approved budget, and expenditure change only through independently reviewed requests. Self-review is rejected for every manager, including super administrators.
- Progress approval requires evidence and must increase task progress. Project progress is the weighted average of approved task progress.
- Budget requests specify a new total. Expense approvals accumulate expenditure, cannot exceed approved budget, and budget revisions cannot reduce it below expenditure.
- Resource usage is a version-checked total. Usage cost is an estimate separate from the approved expense ledger.
- Completion requires an in-progress project, at least one task, every task at 100%, and no pending requests. Pending completion freezes execution changes except evidence uploads and review. Approval requires evidence; rejection restores in-progress status.
- Deadline extension approvals preserve original dates and write schedule history. Direct planning date edits clear a previous extension.
- Evidence accepts PDF/PNG/JPEG signatures, up to 5 MB and ten files per request. Only the pending request's submitter can attach files. Downloads are authorized and forced as attachments.
- Email and employee code remain immutable after account creation to preserve account identity.
- The sample portfolio has planned, in-progress, on-hold, and cancelled projects. Completed/pending fixtures await approval workflows.
- Existing accounts and data are preserved by the additive V3 migration.
- Notifications are in-app; email/SMS is not configured. Evidence is in PostgreSQL; no external storage or malware scanner is configured.
- Excel cells are text to preserve exact decimal values. Native PDFs use printable ASCII; browser Print supports the page's multilingual text.
- Sessions reside in memory. Use one backend instance until shared sessions and coordinated scheduling are configured.
- Production hosting, TLS, automated backups, traffic-specific load testing, and organizational security review remain environment-specific. See DEPLOYMENT.md.
