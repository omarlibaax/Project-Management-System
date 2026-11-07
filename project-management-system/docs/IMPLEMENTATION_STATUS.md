# Implementation status

Phases 1 and 2 are implemented. Phases 3-7 remain.

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

## Remaining phases
3. Historical engineer assignments, revocation, transfer, tasks, and weighted progress.
4. Labor/material planning and usage, budget approvals/revisions, and expenses.
5. Secure evidence storage and transactional approval/completion workflows.
6. Scheduled delay detection, notifications, engineer explanations, approved deadline extensions, advanced charts, PDF, and Excel.
7. Complete business-flow security/performance verification and deployment review.

## Current boundaries
- User administration is SUPER_ADMIN only. ADMIN can manage projects and view the engineer directory.
- Engineer project lists are empty and individual project access is denied until active assignments exist in Phase 3.
- COMPLETED and PENDING_APPROVAL cannot be set through ordinary project create/edit requests.
- Progress, approved budget, and expenditure are read-only until their owning modules exist.
- Phase 2 schedule history records direct manager plan edits; engineer extension requests/approval belong to Phase 6.
- Email and employee code remain immutable after account creation to preserve account identity.
- The sample portfolio has planned, in-progress, on-hold, and cancelled projects. Completed/pending fixtures await approval workflows.
- Production deployment is outside this phase. Existing development accounts and data are preserved.
