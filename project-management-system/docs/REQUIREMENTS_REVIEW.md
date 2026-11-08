# Requirements review — 8 November 2026

| Your requirement | Implementation |
| --- | --- |
| 50+ separate projects | Paginated project portfolio; 55-project aggregation and browser fixtures verified |
| Duration, start/end dates, status | Project dates and inclusive duration; each work item also has start/end dates |
| Finish image | Completion approval requires PNG/JPEG evidence; mobile file input requests the rear camera where supported |
| Manually add labor types, materials, budgets | Free-text resource names/units, labor/material categories, project budget and work allocations |
| Administrator manages all projects | Server-enforced ADMIN/SUPER_ADMIN access; only super administrators manage accounts |
| Assign one or multiple engineers; engineers have multiple projects | Many-to-many active assignments with retained revocation history |
| Revoke and transfer work | Assign replacement, transfer unfinished tasks, then revoke previous engineer; project access is removed |
| Approve work only when resources match | All work at 100%, no pending requests, current work plans approved, every resource's used quantity equals its planned quantity, and a finish photo |
| Per-project charts | Approved task-progress chart and weighted total progress |
| Admin dashboard: all, in progress, on hold, complete | Dedicated KPI cards plus delayed count and full status distribution |
| Low/medium/high priority | Project form, server validation, list filters and badges |
| Work report before deciding to proceed | Work-specific PDF/Excel with project/work dates, duration, work allocation, labor/material breakdown and resource details; WORK_PLAN approval gates progress |
| Mark overdue and require engineer explanation | DELAYED indicator after effective deadline; engineers must submit DELAY_REASON or an extension explanation before further progress/completion |

“Ahead schedule report” is interpreted here as a report for upcoming work **before it proceeds**. AHEAD_OF_SCHEDULE is also displayed when approved progress is more than five percentage points above a linear calendar baseline. AT_RISK means more than ten points below that baseline. These are indicators, not forecasts; elapsed deadlines take precedence. Late completed projects retain a delayed indicator.

## Corrections made

- Added explicit permission-to-proceed requests. Engineers submit the work plan; another manager approves/rejects it. A captured plan includes its dates, budget and resource quantities/costs. Changed plans cannot be approved from an old snapshot.
- Work budgets must cover their linked labor/material costs. Total work allocations plus project-wide resource estimates must fit the approved project budget before permission is granted.
- Added task-linked resources and per-work budgets/reports. Managers can revise work dates/budgets and resource plans with reasons. Revisions are version-checked, audited, and invalidate the affected work approval.
- Completion now checks resource matching and requires an image; a PDF alone is insufficient. Legitimate resource variances require a reasoned manager plan revision and renewed work approval. Do not change actual usage merely to hide a variance.
- Added delay explanations separately from extensions. Acknowledging a reason does not move the deadline. The engineer must give an explanation for the current overdue period.
- Added On hold to the dashboard and ahead/at-risk schedule indicators.

Existing project/account data is retained by additive migration V4. Existing unfinished work needs a current work-plan approval before new progress or completion. Existing completed records remain read-only.

Independent review remains required: engineers normally submit work and the administrator reviews it. If a manager submits a request, a different manager must review it. Camera capture depends on the browser/device; uploading an existing JPEG/PNG remains supported. Local tests exercise image upload and authorization, not physical camera hardware.
