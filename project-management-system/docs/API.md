# Phase 1 HTTP API
Errors use a message property; validation errors also contain fields (field/message).
Infrastructure errors deliberately do not reveal database details.

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| GET | /actuator/health | none | 200 health status |
| GET | /api/auth/csrf | none | 200 {token,headerName} |
| POST | /api/auth/login | application/x-www-form-urlencoded: email,password; CSRF header | 204 session cookie |
| GET | /api/auth/me | session cookie | 200 {id,employeeCode,fullName,email,roles} |
| POST | /api/auth/logout | session cookie; CSRF header | 204 |
| POST | /api/auth/password | JSON {currentPassword,newPassword}; cookie and CSRF | 200, current session invalidated |
| GET | /api/workspace | session cookie | 200 {timezone,currency,phase} |
| GET | /api/admin/access-check | admin session | 200 {access} |

401 means no valid authentication or unavailable account.
403 means insufficient role or missing/invalid CSRF.
400 means invalid input.
Password: 12–64 characters for a new password. Five failed attempts lock an account for
15 minutes. Login errors do not reveal whether an email is registered.
Changing a seed password does not cause it to be reset on restart.
## Phase 2 API
All routes require the session cookie. All mutations also require a fresh CSRF header.
Paging responses use {items,total,page,size,totalPages}. page starts at 0; size is 1-100.
Lists default to 20 records; /managers defaults to 100.

| Method | Path | Authorization | Result |
| --- | --- | --- | --- |
| GET | /api/users | SUPER_ADMIN | Paginated UserView records; search, role, active filters |
| POST | /api/users | SUPER_ADMIN | 201 UserView |
| PUT | /api/users/{id} | SUPER_ADMIN | 200 updated UserView |
| PATCH | /api/users/{id}/status | SUPER_ADMIN | 200 updated UserView |
| GET | /api/engineers | ADMIN/SUPER_ADMIN | Paginated engineers; search and active filters |
| GET | /api/managers | ADMIN/SUPER_ADMIN | Paginated active ADMIN/SUPER_ADMIN accounts |
| GET | /api/departments | ADMIN/SUPER_ADMIN | DepartmentView[] |
| POST | /api/departments | SUPER_ADMIN | 201 DepartmentView |
| GET | /api/projects | Authenticated | Manager portfolio or actively assigned engineer projects |
| POST | /api/projects | ADMIN/SUPER_ADMIN | 201 ProjectView |
| GET | /api/projects/{id} | Managers / assigned engineers | ProjectView; 404 for unauthorized engineers |
| PUT | /api/projects/{id} | ADMIN/SUPER_ADMIN | Updated ProjectView |
| PATCH | /api/projects/{id}/archive | ADMIN/SUPER_ADMIN | Archived ProjectView |
| GET | /api/projects/{id}/schedule-history | Managers / assigned engineers | ScheduleView[] |
| GET | /api/dashboard/admin | ADMIN/SUPER_ADMIN | Portfolio Summary |
| GET | /api/dashboard/engineer | Authenticated | {assignmentManagementAvailable:true,assignedProjects,unfinishedTasks} |

CreateUser fields: employeeCode (required, <=40), fullName (required, <=160),
email (valid, <=254), phone (optional, <=40), departmentId (optional),
position (optional, <=120), roles (non-empty array: SUPER_ADMIN/ADMIN/ENGINEER),
password (12-64 characters). No public registration exists.
UpdateUser fields: fullName, phone, departmentId, position, roles, version.
Employee code and email cannot be changed. AccountStatus: {active,version}.
NewDepartment: {name}, non-blank and <=120.
UserView: id, employeeCode, fullName, email, phone, department, departmentId, position,
roles, active, createdAt, updatedAt, lastLogin, version. It never contains a password/hash.

ProjectInput fields: name (required, <=180), description (required string, <=4000),
category (required, <=120), location (required, <=240), client (required, <=180),
managerId (active ADMIN/SUPER_ADMIN), plannedStartDate, plannedEndDate (ISO dates),
priority (LOW/MEDIUM/HIGH), status, plannedBudget (non-negative decimal, <=17 integer
digits and <=2 decimal digits), scheduleChangeReason (<=1000), version.
For updates version is required. For date changes a non-blank reason is required.
Allowed writable statuses: PLANNED, IN_PROGRESS, ON_HOLD, CANCELLED.
Started projects cannot return to PLANNED. Cancelled, completed, pending-approval,
and archived projects cannot be edited. Completion states require the request workflow.
ArchiveInput: {version}. No hard-delete endpoint exists.

ProjectView: id, code, name, description, category, location, client, managerId,
managerName, plannedStartDate, plannedEndDate, originalStartDate, originalEndDate,
plannedDuration, actualStartDate, actualEndDate, revisedEndDate, priority, status,
scheduleCondition, plannedBudget, approvedBudget, actualExpenditure, progress, archived,
createdBy, createdAt, updatedAt, version. Monetary fields are exact decimal strings;
progress is numeric. Duration is inclusive calendar days.
ScheduleView: id, previousStart, previousEnd, newStart, newEnd, reason, changedBy, changedAt.

Project list filters: search (name/code/location), status, priority, archived (default
false; true lists archived records only), page, size, sort, direction.
sort allowlist: name, createdAt, plannedEndDate, priority, status, code.
direction: asc or desc; defaults createdAt desc. Name/status/priority sorting is lexical.
User list search covers full name, employee code, and email.

Summary fields: total, planned, inProgress, onHold, pendingApproval, completed,
cancelled, delayed, highPriority, plannedBudget, actualExpenditure, currency, byStatus.
See PHASE_2.md for overlapping KPI definitions and archived-record exclusions.
400: validation error. 401: session unavailable. 403: role/CSRF failure.
404: missing or unauthorized project. 409: duplicate identity, stale version,
unsupported transition, or read-only record.
# Execution API (V3)

V4 additions: `WORK_PLAN` requests require `taskId` and capture work dates, budget and resources. Approval grants permission to submit progress for that unchanged plan, with allocated budgets checked against approved project funds. `DELAY_REASON` records an overdue explanation without changing dates. Overdue engineers must explain the current delay before further progress/completion. Completion requires matching resource quantities, approved current work plans and a PNG/JPEG finish photo.

Tasks also accept optional `startDate` and `plannedBudget`; resources accept optional `taskId`. `PATCH /projects/{id}/tasks/{taskId}/plan` accepts `{startDate,dueDate,plannedBudget,version,reason}`. `PATCH /projects/{id}/resources/{resourceId}/plan` accepts `{planned,unitCost,version,reason}`. Both require management, retain revision history, and invalidate the affected work approval. PDF/Excel exports accept optional `?taskId=...` to generate a work-specific pre-work report. Execution responses also include `resourceHistory` and `workHistory`.

All paths below start with `/api`. Existing session authentication and CSRF requirements apply. Workflow mutations lock the project and increment its version. Decimal quantities and monetary values in execution responses are JSON strings.

| Method and path | Body / result |
| --- | --- |
| GET `/projects/{id}/execution` | Assignments, tasks, resources, requests, evidence metadata |
| POST `/projects/{id}/assignments` | `{ engineerId }`; managers only |
| DELETE `/projects/{id}/assignments/{assignmentId}` | Revoke; transfer unfinished tasks first |
| POST `/projects/{id}/tasks` | `{ title, engineerId, dueDate, weight }`; assigned active owner required |
| PATCH `/projects/{id}/tasks/{taskId}/owner` | `{ engineerId }`; managers only |
| POST `/projects/{id}/resources` | `{ kind: "LABOR" or "MATERIAL", name, unit, planned, unitCost }` |
| PATCH `/projects/{id}/resources/{resourceId}` | `{ used, version }`; replaces total usage |
| POST `/projects/{id}/requests` | `{ kind, taskId?, amount?, requestedDate?, reason }`; returns `{ id }` |
| POST `/projects/{id}/requests/{requestId}/review` | `{ approve: boolean, note }`; different manager required |
| POST `/projects/{id}/requests/{requestId}/evidence` | Multipart `file`, submitter only while pending, 5 MB/file, ten files/request |
| GET `/projects/{id}/evidence/{evidenceId}` | Authorized attachment download |
| GET `/projects/{id}/report.xlsx` | Native Excel report with text cells preserving exact decimals |
| GET `/projects/{id}/report.pdf` | Native printable-ASCII PDF report |
| GET `/projects/{id}/report.csv` | UTF-8 CSV, spreadsheet formula prefixes neutralized |
| GET `/notifications` | Latest 100 notifications belonging to the current user |
| PATCH `/notifications/{id}/read` | Mark own notification read |

Request kinds: `PROGRESS` requires an owned task and a greater percentage up to 100; `EXPENSE` requires a positive amount; `BUDGET` requires a manager and specifies the new approved total; `EXTENSION` requires a later requestedDate and an explanation; `COMPLETION` requires all tasks approved at 100% and no pending requests. Reasons are limited to 1000 characters. An explicit boolean decision and a review note are required for review. Evidence is required to approve progress and completion. See EXECUTION.md and IMPLEMENTATION_STATUS.md for complete rules.

Engineers can read only actively assigned projects. Unassigned project/evidence/report reads return 404. Missing role or self-review returns 403, invalid values return 400, stale usage or invalid workflow state returns 409, oversized multipart input returns 413. Repeated reviews return 409. Files are served as attachments with `nosniff` and `no-store`.
