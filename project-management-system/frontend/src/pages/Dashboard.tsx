import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  Building2,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Pause,
  Wallet,
  CreditCard,
  Landmark,
  Plus,
  CalendarDays,
  ArrowRight,
  Activity,
  ClipboardCheck,
  HardHat,
} from "lucide-react";
import { api, type Profile } from "../api";
import type { Summary } from "../types";
import {
  Badge,
  Empty,
  ErrorNotice,
  Heading,
  Loading,
  money,
} from "../components/shared";
import { Button } from "../components/ui/button";
import {
  usePortfolio,
  useExecutionPortfolio,
  subtractMoney,
  sumMoney,
  dateLabel,
  todayIn,
} from "../lib/portfolio";
const StatusChart = lazy(() =>
  import("../components/PortfolioCharts").then((m) => ({
    default: m.StatusChart,
  })),
);
const BudgetChart = lazy(() =>
  import("../components/PortfolioCharts").then((m) => ({
    default: m.BudgetChart,
  })),
);
const CompletionChart = lazy(() =>
  import("../components/PortfolioCharts").then((m) => ({
    default: m.CompletionChart,
  })),
);

export default function Dashboard({ user }: { user: Profile }) {
  const admin = user.roles.some((r) => ["ADMIN", "SUPER_ADMIN"].includes(r));
  const assigned = useQuery({
    queryKey: ["dashboard", "engineer"],
    enabled: !admin,
    queryFn: async () =>
      (
        await api.get<{ assignedProjects: number; unfinishedTasks: number }>(
          "/dashboard/engineer",
        )
      ).data,
  });
  const summary = useQuery({
    queryKey: ["dashboard"],
    enabled: admin,
    queryFn: async () => (await api.get<Summary>("/dashboard/admin")).data,
  });
  const portfolio = usePortfolio();
  const projects = portfolio.data ?? [];
  const executions = useExecutionPortfolio(projects, admin);
  const executionPending = executions.some((q) => q.isPending);
  const executionError = executions.find((q) => q.isError);
  const rows = executions.flatMap((q) => q.data ?? []);
  const pending = rows.flatMap(({ project, workspace }) =>
    workspace.requests
      .filter((r) => r.state === "PENDING")
      .map((request) => ({ project, request })),
  );
  const engineers = new Map<
    number,
    { name: string; projects: number; tasks: number }
  >();
  for (const { workspace } of rows)
    for (const a of workspace.assignments.filter((a) => !a.revoked_at)) {
      const current = engineers.get(a.engineer_id) ?? {
        name: a.full_name,
        projects: 0,
        tasks: 0,
      };
      current.projects++;
      current.tasks += workspace.tasks.filter(
        (t) => t.engineer_id === a.engineer_id && Number(t.progress) < 100,
      ).length;
      engineers.set(a.engineer_id, current);
    }
  const workload = [...engineers]
    .sort((a, b) => b[1].tasks - a[1].tasks)
    .slice(0, 5);
  const today = todayIn();
  const upcoming = projects
    .filter(
      (p) =>
        !["COMPLETED", "CANCELLED"].includes(p.status) &&
        (p.revisedEndDate ?? p.plannedEndDate) >= today,
    )
    .sort((a, b) =>
      (a.revisedEndDate ?? a.plannedEndDate).localeCompare(
        b.revisedEndDate ?? b.plannedEndDate,
      ),
    )
    .slice(0, 4);
  const attention = projects
    .filter((p) => p.scheduleCondition === "DELAYED" || p.priority === "HIGH")
    .slice(0, 4);
  const recent = [...projects]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const activity = [...projects]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);
  const heading = (
    <Heading
      title="Portfolio overview"
      description={`Welcome back, ${user.fullName.split(" ")[0]}. Here’s where your projects stand today.`}
    >
      <span className="date-chip">
        <CalendarDays size={15} />
        {new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Africa/Nairobi",
        }).format(new Date())}
      </span>
    </Heading>
  );
  if (!admin)
    return (
      <>
        {heading}
        <div className="welcome-banner">
          <div>
            <p className="eyebrow">YOUR ENGINEERING WORKSPACE</p>
            <h2>Good work starts with a clear plan.</h2>
            <p>
              Follow your assignments, update progress, and keep your team
              moving.
            </p>
          </div>
          <Building2 size={62} />
        </div>
        {assigned.isPending ? (
          <Loading />
        ) : assigned.isError ? (
          <ErrorNotice
            error={assigned.error}
            retry={() => assigned.refetch()}
          />
        ) : (
          <div className="engineer-summary">
            <article className="panel">
              <span className="muted">Assigned projects</span>
              <h2>{assigned.data.assignedProjects}</h2>
            </article>
            <article className="panel">
              <span className="muted">Unfinished tasks</span>
              <h2>{assigned.data.unfinishedTasks}</h2>
            </article>
          </div>
        )}
        <section className="panel">
          <div className="section-heading">
            <h2>Your projects</h2>
            <Link className="text-link" to="/my-projects">
              View assignments <ArrowRight size={15} />
            </Link>
          </div>
          {portfolio.isPending ? (
            <Loading />
          ) : portfolio.isError ? (
            <ErrorNotice error={portfolio.error} />
          ) : !projects.length ? (
            <Empty title="No projects assigned yet" />
          ) : (
            projects.slice(0, 6).map((p) => (
              <Link
                className="deadline-row"
                to={"/projects/" + p.id}
                key={p.id}
              >
                <span className="project-symbol">
                  <Building2 size={18} />
                </span>
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {dateLabel(p.revisedEndDate ?? p.plannedEndDate)}
                  </small>
                </div>
                <Badge value={p.status} />
              </Link>
            ))
          )}
        </section>
      </>
    );
  if (summary.isPending)
    return (
      <>
        {heading}
        <Loading />
      </>
    );
  if (summary.isError)
    return (
      <>
        {heading}
        <ErrorNotice error={summary.error} retry={() => summary.refetch()} />
      </>
    );
  const data = summary.data;
  const available = portfolio.data
    ? subtractMoney(
        sumMoney(projects.map((p) => p.approvedBudget)),
        sumMoney(projects.map((p) => p.actualExpenditure)),
      )
    : null;
  const metrics = [
    {
      name: "Total Projects",
      value: String(data.total),
      Icon: Building2,
      tone: "blue",
      note: "Across your portfolio",
    },
    {
      name: "In Progress",
      value: String(data.inProgress),
      Icon: Clock3,
      tone: "blue",
      note: "Work currently underway",
    },
    {
      name: "Completed",
      value: String(data.completed),
      Icon: CheckCircle2,
      tone: "green",
      note: "Accepted project completions",
    },
    {
      name: "On Hold",
      value: String(data.onHold),
      Icon: Pause,
      tone: "amber",
      note: "Paused for the next step",
    },
    {
      name: "Overdue Projects",
      value: String(data.delayed),
      Icon: AlertTriangle,
      tone: "red",
      note: "Require your attention",
    },
    {
      name: "Total Budget",
      value: money(data.plannedBudget, data.currency),
      Icon: Wallet,
      tone: "blue",
      note: "Planned project budgets",
      financial: true,
    },
    {
      name: "Total Expenditure",
      value: money(data.actualExpenditure, data.currency),
      Icon: CreditCard,
      tone: "purple",
      note: "Approved project expenses",
      financial: true,
    },
    {
      name: "Available Budget",
      value: available === null ? "—" : money(available, data.currency),
      Icon: Landmark,
      tone: "green",
      note:
        available === null
          ? "Loading approved budgets…"
          : "Approved budget less expenditure",
      financial: true,
    },
  ];
  return (
    <>
      {heading}
      <div className="dashboard-intro">
        <span className="live-indicator" /> Live portfolio data{" "}
        <span className="intro-divider" />
        Your organization at a glance
      </div>
      <div className="kpi-grid">
        {metrics.map(({ name, value, Icon, tone, note, financial }) => (
          <article className={"panel metric-card " + tone} key={name}>
            <div className="metric-top">
              <span>{name}</span>
              <span className="metric-icon">
                <Icon size={18} />
              </span>
            </div>
            <strong className={financial ? "financial-value" : ""}>
              {value}
            </strong>
            <small>{note}</small>
          </article>
        ))}
      </div>
      <div className="analytics-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Project status</h2>
              <p className="muted">A balanced view of your portfolio</p>
            </div>
            <span className="subtle-tag">All projects</span>
          </div>
          <Suspense fallback={<Loading />}>
            <StatusChart summary={data} />
          </Suspense>
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Budget & expenditure</h2>
              <p className="muted">
                Planned investment against approved expenses
              </p>
            </div>
            <Link
              to="/budgets"
              className="icon-button"
              aria-label="View budgets"
            >
              <ArrowUpRight size={18} />
            </Link>
          </div>
          {portfolio.isPending ? (
            <Loading />
          ) : portfolio.isError ? (
            <ErrorNotice error={portfolio.error} />
          ) : (
            <Suspense fallback={<Loading />}>
              <BudgetChart projects={projects} currency={data.currency} />
            </Suspense>
          )}
        </section>
      </div>
      <div className="dashboard-lower-grid">
        <section className="panel recent-projects">
          <div className="section-heading">
            <div>
              <h2>Recent projects</h2>
              <p className="muted">The latest additions to your workspace</p>
            </div>
            <Link to="/projects" className="text-link">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          {portfolio.isPending ? (
            <Loading />
          ) : portfolio.isError ? (
            <ErrorNotice
              error={portfolio.error}
              retry={() => portfolio.refetch()}
            />
          ) : !recent.length ? (
            <Empty title="Your first project starts here">
              <p>Create a project to begin building your portfolio.</p>
              <Button asChild>
                <Link to="/projects/new">
                  <Plus size={16} /> Create project
                </Link>
              </Button>
            </Empty>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link className="project-name" to={"/projects/" + p.id}>
                          {p.name}
                        </Link>
                        <small>
                          {p.code} · {p.managerName}
                        </small>
                      </td>
                      <td>
                        <Badge value={p.status} />
                      </td>
                      <td>
                        <div className="table-progress">
                          <span>{p.progress}%</span>
                          <progress
                            value={p.progress}
                            max={100}
                            aria-label={p.name + " progress"}
                          />
                        </div>
                      </td>
                      <td>{dateLabel(p.revisedEndDate ?? p.plannedEndDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Upcoming deadlines</h2>
              <p className="muted">Keep the next milestone in sight</p>
            </div>
            <CalendarDays size={19} className="muted" />
          </div>
          {portfolio.isPending ? (
            <Loading />
          ) : portfolio.isError ? (
            <ErrorNotice error={portfolio.error} />
          ) : !upcoming.length ? (
            <Empty title="No upcoming deadlines" />
          ) : (
            upcoming.map((p) => (
              <Link
                className="deadline-row"
                to={"/projects/" + p.id}
                key={p.id}
              >
                <span className="deadline-date">
                  <strong>
                    {(p.revisedEndDate ?? p.plannedEndDate).slice(8, 10)}
                  </strong>
                  <small>
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      timeZone: "UTC",
                    }).format(
                      new Date(
                        (p.revisedEndDate ?? p.plannedEndDate) + "T12:00:00Z",
                      ),
                    )}
                  </small>
                </span>
                <div>
                  <strong>{p.name}</strong>
                  <small>{p.code}</small>
                </div>
                <ArrowUpRight size={15} />
              </Link>
            ))
          )}
          <Link to="/calendar" className="panel-footer-link">
            View calendar <ArrowRight size={14} />
          </Link>
        </section>
      </div>
      <div className="three-column-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Requires attention</h2>
            <AlertTriangle size={18} className="danger-text" />
          </div>
          {portfolio.isError ? (
            <ErrorNotice error={portfolio.error} />
          ) : !attention.length ? (
            <Empty title="No projects flagged" />
          ) : (
            attention.map((p) => (
              <Link
                className="attention-row"
                key={p.id}
                to={"/projects/" + p.id}
              >
                <span className="attention-dot" />
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {p.scheduleCondition === "DELAYED"
                      ? "Overdue schedule"
                      : "High priority"}
                  </small>
                </div>
                <ArrowUpRight size={14} />
              </Link>
            ))
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Pending approvals</h2>
            <ClipboardCheck size={18} className="blue" />
          </div>
          {executionPending ? (
            <Loading />
          ) : executionError ? (
            <ErrorNotice
              error={executionError.error}
              retry={() => executionError.refetch()}
            />
          ) : !pending.length ? (
            <Empty title="All clear for now">
              <p>No pending project requests.</p>
            </Empty>
          ) : (
            <>
              <p className="approval-count">
                {pending.length}
                <span>requests awaiting review</span>
              </p>
              {pending.slice(0, 3).map(({ project, request }) => (
                <Link
                  className="attention-row"
                  key={request.id}
                  to={"/projects/" + project.id + "#approvals"}
                >
                  <div>
                    <strong>{request.kind.replaceAll("_", " ")}</strong>
                    <small>
                      {project.name} · {request.full_name}
                    </small>
                  </div>
                  <ArrowUpRight size={14} />
                </Link>
              ))}
            </>
          )}
          <Link className="panel-footer-link" to="/approvals">
            Open approvals <ArrowRight size={14} />
          </Link>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Engineer workload</h2>
            <HardHat size={18} className="muted" />
          </div>
          {executionPending ? (
            <Loading />
          ) : executionError ? (
            <ErrorNotice error={executionError.error} />
          ) : !workload.length ? (
            <Empty title="No engineers assigned yet" />
          ) : (
            workload.map(([id, e]) => (
              <div className="workload-row" key={id}>
                <span className="avatar">{e.name.slice(0, 1)}</span>
                <div>
                  <strong>{e.name}</strong>
                  <small>
                    {e.projects} projects · {e.tasks} unfinished tasks
                  </small>
                </div>
              </div>
            ))
          )}
          <Link className="panel-footer-link" to="/engineers">
            View team <ArrowRight size={14} />
          </Link>
        </section>
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Project completions</h2>
              <p className="muted">
                Accepted completions by actual finish month
              </p>
            </div>
            <CheckCircle2 size={18} className="success-text" />
          </div>
          {portfolio.isPending ? (
            <Loading />
          ) : portfolio.isError ? (
            <ErrorNotice error={portfolio.error} />
          ) : (
            <Suspense fallback={<Loading />}>
              <CompletionChart projects={projects} />
            </Suspense>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Recently updated</h2>
              <p className="muted">Latest project record changes</p>
            </div>
            <Activity size={18} className="muted" />
          </div>
          {portfolio.isError ? (
            <ErrorNotice error={portfolio.error} />
          ) : !activity.length ? (
            <Empty title="Your project updates will appear here" />
          ) : (
            activity.map((p) => (
              <Link
                className="activity-row"
                key={p.id}
                to={"/projects/" + p.id}
              >
                <span className="activity-icon">
                  <Building2 size={16} />
                </span>
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    Project record updated · {dateLabel(p.updatedAt)}
                  </small>
                </div>
                <ArrowUpRight size={14} />
              </Link>
            ))
          )}
        </section>
      </div>
    </>
  );
}
