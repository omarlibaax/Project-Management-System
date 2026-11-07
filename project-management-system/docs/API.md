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
| GET | /api/projects | Authenticated | Manager portfolio or empty engineer list |
| POST | /api/projects | ADMIN/SUPER_ADMIN | 201 ProjectView |
| GET | /api/projects/{id} | ADMIN/SUPER_ADMIN | ProjectView; 404 for unauthorized engineers |
| PUT | /api/projects/{id} | ADMIN/SUPER_ADMIN | Updated ProjectView |
| PATCH | /api/projects/{id}/archive | ADMIN/SUPER_ADMIN | Archived ProjectView |
| GET | /api/projects/{id}/schedule-history | ADMIN/SUPER_ADMIN | ScheduleView[] |
| GET | /api/dashboard/admin | ADMIN/SUPER_ADMIN | Portfolio Summary |
| GET | /api/dashboard/engineer | Authenticated | {assignmentManagementAvailable:false}; assignments arrive in Phase 3 |

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
and archived projects cannot be edited. Completion states require the future workflow.
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
