# Project execution walkthrough

Start the application using README.md. Existing databases receive additive migration V3 at backend startup; existing accounts, passwords, and projects are preserved.

1. Sign in as the super administrator and create a second `ADMIN` account under Users. Independent review requires a different manager from the submitter.
2. Create a project with status In progress and a realistic date range. Open its detail page.
3. Under Engineer assignments, search for and assign an active engineer. Under Tasks, create tasks with owners, start/end dates within the project dates, work budget allocations, and positive relative weights.
4. Plan labor and materials with a unit, planned quantity, and unit cost. Record total usage as work proceeds. The table shows variance and estimated usage costs.
5. Submit a Budget request specifying the total budget to approve. Sign in as the second manager, open the project, and approve it with a review explanation. Submit expenses and review them through the same process. Approved expenditure updates the project and portfolio dashboard.
6. Link labor/material resources to the work item. Sign in as the engineer and submit a Work plan request. The manager reviews the captured dates, budget and resource breakdown and approves permission to proceed. Then submit Task progress for an owned task; its percentage must increase. Attach evidence using the request card. A changed work/resource plan requires renewed approval.
7. Sign in as a different manager. Inspect/download the evidence and approve progress. Approved task progress and weighted project progress update together. A rejected request keeps existing progress and permits resubmission.
8. To transfer work, assign the replacement engineer first, then transfer unfinished tasks. Review pending progress before transfer. Revoke the previous engineer's assignment when they have no unfinished tasks.
9. To explain a delay, submit a Deadline extension request with the reason and a later date. Approval changes the effective deadline and records schedule history. Hourly checks create one overdue notification per deadline and recipient. Notifications has links to projects and a Mark read action.
10. When every task is approved at 100%, all current work plans are approved, resource usage matches planned quantities, and no requests are pending, submit Project completion and attach a PNG/JPEG finish photo. Supported mobile browsers offer camera capture. A different manager approves or rejects it. Approval makes execution read-only; rejection reopens the in-progress project.
11. Export Excel, PDF, or CSV from Project execution. Use Print for a formatted page report. Exports include assignments, tasks, resources, and requests; evidence remains available through authorized downloads.

Every API mutation requires a valid session and CSRF token. An unassigned engineer cannot access project details, history, execution records, evidence, or reports. Review a request's latest values and evidence before approving.

Overdue engineers must submit Delay explanation or an explained extension request before further progress/completion. Acknowledging an explanation preserves the deadline. See REQUIREMENTS_REVIEW.md for the full requirement mapping and schedule indicator definitions.
