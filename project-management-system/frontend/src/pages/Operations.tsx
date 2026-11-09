import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  Search,
  ArrowUpRight,
  Download,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
} from "lucide-react";
import { api, type Profile } from "../api";
import {
  Badge,
  Empty,
  ErrorNotice,
  Heading,
  Loading,
  Pagination,
  label,
  money,
} from "../components/shared";
import { Button } from "../components/ui/button";
import {
  usePortfolio,
  useExecutionPortfolio,
  subtractMoney,
  dateLabel,
  todayIn,
} from "../lib/portfolio";
import type { Project } from "../types";
import { Timeline } from "./ProjectExplorer";

const titles: Record<string, [string, string]> = {
  tasks: ["Tasks", "A shared view of work, ownership, and approved progress."],
  labour: [
    "Labour",
    "Track planned labour and recorded usage across projects.",
  ],
  materials: [
    "Materials",
    "Keep material plans, quantities, and usage in view.",
  ],
  budgets: ["Budgets", "Plan investment. Follow approved expenditure."],
  calendar: [
    "Project calendar",
    "See project schedules and upcoming delivery dates.",
  ],
  reports: ["Reports", "Export project records and work plans for your team."],
  approvals: [
    "Approvals",
    "Review requests with context. Keep decisions independent.",
  ],
};

export default function Operations({
  module,
  user,
}: {
  module: string;
  user: Profile;
}) {
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("");
  const [state, setState] = useState("PENDING");
  const [page, setPage] = useState(0);
  const portfolio = usePortfolio();
  const projects = portfolio.data ?? [];
  const needsExecution = ["tasks", "labour", "materials", "approvals"].includes(
    module,
  );
  const execution = useExecutionPortfolio(projects, needsExecution);
  const settings = useQuery({
    queryKey: ["workspace"],
    queryFn: async () =>
      (await api.get<{ currency: string; timezone: string }>("/workspace"))
        .data,
  });
  const executionError = needsExecution && execution.find((q) => q.isError);
  const loading =
    portfolio.isPending ||
    (needsExecution && execution.some((q) => q.isPending));
  const data = execution.flatMap((q) => q.data ?? []);
  const matches = (project: Project, text = "") =>
    (!projectId || String(project.id) === projectId) &&
    `${project.name} ${project.code} ${text}`
      .toLowerCase()
      .includes(search.toLowerCase());
  const filteredProjects = projects.filter((p) => matches(p));
  const tasks = data.flatMap(({ project, workspace }) =>
    workspace.tasks
      .filter((t) => matches(project, t.title + " " + t.full_name))
      .map((task) => ({ project, task })),
  );
  const resources = data.flatMap(({ project, workspace }) =>
    workspace.resources
      .filter(
        (r) =>
          r.kind === (module === "labour" ? "LABOR" : "MATERIAL") &&
          matches(project, r.name),
      )
      .map((resource) => ({ project, resource })),
  );
  const requests = data.flatMap(({ project, workspace }) =>
    workspace.requests
      .filter(
        (r) =>
          (!state || r.state === state) &&
          matches(project, r.reason + " " + r.full_name + " " + r.kind),
      )
      .map((request) => ({ project, request })),
  );
  const total =
    module === "tasks"
      ? tasks.length
      : ["labour", "materials"].includes(module)
        ? resources.length
        : module === "approvals"
          ? requests.length
          : filteredProjects.length;
  const slice = <T,>(rows: T[]) => rows.slice(page * 20, page * 20 + 20);
  const [title, description] = titles[module];
  const amount = (value: string) =>
    settings.data ? money(value, settings.data.currency) : value;
  return (
    <>
      <Heading title={title} description={description} />
      <section className="panel operations-panel">
        <div className="filters">
          <label className="search-control">
            <Search size={17} />
            <input
              aria-label={`Search ${title.toLowerCase()}`}
              value={search}
              placeholder={`Search ${title.toLowerCase()}…`}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <select
            aria-label="Filter by project"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {module === "approvals" && (
            <select
              aria-label="Request status"
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All requests</option>
              <option value="PENDING">Pending review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          )}
        </div>
        {loading ? (
          <Loading />
        ) : portfolio.isError ? (
          <ErrorNotice
            error={portfolio.error}
            retry={() => portfolio.refetch()}
          />
        ) : executionError ? (
          <ErrorNotice
            error={executionError.error}
            retry={() => executionError.refetch()}
          />
        ) : module === "calendar" ? (
          <ProjectCalendar
            projects={filteredProjects}
            timezone={settings.data?.timezone}
          />
        ) : !total ? (
          <Empty
            title={
              module === "approvals"
                ? "No requests to review"
                : `No ${title.toLowerCase()} yet`
            }
          >
            <p>
              {module === "approvals"
                ? "Requests submitted from projects will appear here."
                : "Open a project to manage its records and workflows."}
            </p>
            <Button asChild variant="outline">
              <Link to="/projects">Browse projects</Link>
            </Button>
          </Empty>
        ) : (
          <>
            {module === "tasks" && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Task / project</th>
                      <th>Engineer</th>
                      <th>Schedule</th>
                      <th>Work budget</th>
                      <th>Approved progress</th>
                      <th>Work plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice(tasks).map(({ project: p, task: t }) => (
                      <tr key={t.id}>
                        <td>
                          <Link
                            className="project-name"
                            to={`/projects/${p.id}#tasks`}
                          >
                            {t.title}
                          </Link>
                          <small>{p.name}</small>
                        </td>
                        <td>{t.full_name}</td>
                        <td>
                          {dateLabel(t.start_date)}
                          <small>Due {dateLabel(t.due_date)}</small>
                        </td>
                        <td>{amount(t.planned_budget)}</td>
                        <td>
                          <div className="table-progress">
                            <span>{t.progress}%</span>
                            <progress
                              max={100}
                              value={Number(t.progress)}
                              aria-label={t.title + " progress"}
                            />
                          </div>
                        </td>
                        <td>
                          <span
                            className={`badge ${t.authorized_plan ? "badge-active" : "badge-pending_approval"}`}
                          >
                            {t.authorized_plan
                              ? "Authorized"
                              : "Approval required"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {["labour", "materials"].includes(module) && (
              <>
                <p className="view-note">
                  Usage costs are estimates. Approved expenses are recorded
                  separately in Budgets.
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Resource / project</th>
                        <th>Unit</th>
                        <th>Planned</th>
                        <th>Used</th>
                        <th>Variance</th>
                        <th>Unit cost</th>
                        <th>Usage estimate</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {slice(resources).map(({ project: p, resource: r }) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.name}</strong>
                            <small>{p.name}</small>
                          </td>
                          <td>{r.unit}</td>
                          <td>{r.planned}</td>
                          <td>{r.used}</td>
                          <td
                            className={
                              Number(r.variance) !== 0 ? "danger-text" : ""
                            }
                          >
                            {r.variance}
                          </td>
                          <td>{amount(r.unit_cost)}</td>
                          <td>{amount(r.usage_cost)}</td>
                          <td>
                            <Link
                              className="text-link"
                              to={`/projects/${p.id}#resources`}
                            >
                              Manage <ArrowUpRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {module === "budgets" && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Planned budget</th>
                      <th>Approved budget</th>
                      <th>Actual expenditure</th>
                      <th>Approved remaining</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {slice(filteredProjects).map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link
                            className="project-name"
                            to={`/projects/${p.id}`}
                          >
                            {p.name}
                          </Link>
                          <small>{p.code}</small>
                        </td>
                        <td>{amount(p.plannedBudget)}</td>
                        <td>{amount(p.approvedBudget)}</td>
                        <td>{amount(p.actualExpenditure)}</td>
                        <td>
                          {amount(
                            subtractMoney(
                              p.approvedBudget,
                              p.actualExpenditure,
                            ),
                          )}
                        </td>
                        <td>
                          <Link
                            className="text-link"
                            to={`/projects/${p.id}#approvals`}
                          >
                            Requests <ArrowUpRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {module === "approvals" && (
              <div className="approval-list">
                {slice(requests).map(({ project: p, request: r }) => (
                  <article className="approval-item" key={r.id}>
                    <span className="approval-item-icon">
                      <ClipboardCheck size={21} />
                    </span>
                    <div>
                      <div className="approval-item-heading">
                        <h3>{label(r.kind)}</h3>
                        <Badge value={r.state} />
                      </div>
                      <Link
                        className="text-link"
                        to={`/projects/${p.id}#approvals`}
                      >
                        {p.name}
                      </Link>
                      <p>{r.reason}</p>
                      <small>
                        {r.full_name} · {dateLabel(r.submitted_at)}
                        {r.amount !== null
                          ? ` · ${r.kind === "PROGRESS" ? r.amount + "%" : amount(r.amount)}`
                          : ""}
                      </small>
                      {r.submitted_by === user.id && r.state === "PENDING" && (
                        <small className="review-hint">
                          A different manager must review this request.
                        </small>
                      )}
                    </div>
                    <Button asChild variant="outline">
                      <Link to={`/projects/${p.id}#approvals`}>
                        {r.state === "PENDING" && r.submitted_by !== user.id
                          ? "Review request"
                          : "View request"}
                        <ArrowUpRight size={14} />
                      </Link>
                    </Button>
                  </article>
                ))}
              </div>
            )}
            {module === "reports" && (
              <div className="report-grid">
                {slice(filteredProjects).map((p) => (
                  <article className="project-card" key={p.id}>
                    <span className="icon-tile">
                      <FileSpreadsheet size={22} />
                    </span>
                    <small>{p.code}</small>
                    <h3>{p.name}</h3>
                    <p className="muted">
                      Project progress, resources, financials, and request
                      records.
                    </p>
                    <div className="actions">
                      {["pdf", "xlsx", "csv"].map((format) => (
                        <a
                          className="button outline"
                          key={format}
                          href={`/api/projects/${p.id}/report.${format}`}
                        >
                          <Download size={14} />
                          {format.toUpperCase()}
                        </a>
                      ))}
                    </div>
                    <Link
                      className="panel-footer-link"
                      to={`/projects/${p.id}`}
                    >
                      Work item reports <ArrowRightIcon />
                    </Link>
                  </article>
                ))}
              </div>
            )}
            <Pagination
              page={page}
              total={total}
              totalPages={Math.ceil(total / 20)}
              onPage={setPage}
            />
          </>
        )}
      </section>
    </>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={14} />;
}

function ProjectCalendar({
  projects,
  timezone,
}: {
  projects: Project[];
  timezone?: string;
}) {
  const [month, setMonth] = useState(() => todayIn(timezone).slice(0, 7));
  const [view, setView] = useState("month");
  const year = Number(month.slice(0, 4)),
    monthIndex = Number(month.slice(5, 7)) - 1;
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const changeMonth = (delta: number) =>
    setMonth(
      new Date(Date.UTC(year, monthIndex + delta, 1)).toISOString().slice(0, 7),
    );
  return (
    <>
      <div className="calendar-toolbar">
        <div className="actions">
          <Button
            variant="outline"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <h2>
            {new Intl.DateTimeFormat("en", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(first)}
          </h2>
          <Button
            variant="outline"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
          >
            <ChevronRight size={16} />
          </Button>
          <Button
            variant="outline"
            onClick={() => setMonth(todayIn(timezone).slice(0, 7))}
          >
            Today
          </Button>
        </div>
        <div className="view-switch">
          <button
            aria-pressed={view === "month"}
            onClick={() => setView("month")}
          >
            Month
          </button>
          <button
            aria-pressed={view === "timeline"}
            onClick={() => setView("timeline")}
          >
            Timeline
          </button>
        </div>
      </div>
      {view === "timeline" ? (
        projects.length ? (
          <Timeline projects={projects} />
        ) : (
          <Empty title="No project schedules yet" />
        )
      ) : (
        <>
          <div className="calendar-grid calendar-weekdays">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {Array.from(
              { length: Math.ceil((offset + days) / 7) * 7 },
              (_, index) => {
                const day = index - offset + 1;
                const date = month + "-" + String(day).padStart(2, "0");
                return (
                  <div
                    className={`calendar-cell ${day < 1 || day > days ? "outside" : ""} ${date === todayIn(timezone) ? "today" : ""}`}
                    key={index}
                  >
                    {day >= 1 && day <= days && (
                      <>
                        <span>{day}</span>
                        {projects
                          .filter(
                            (p) =>
                              p.plannedStartDate === date ||
                              (p.revisedEndDate ?? p.plannedEndDate) === date,
                          )
                          .map((p) => (
                            <Link
                              to={`/projects/${p.id}`}
                              title={p.name}
                              className={
                                p.plannedStartDate === date
                                  ? "calendar-event start"
                                  : "calendar-event"
                              }
                              key={p.id}
                            >
                              {p.plannedStartDate === date
                                ? "Start: "
                                : "Due: "}
                              {p.name}
                            </Link>
                          ))}
                      </>
                    )}
                  </div>
                );
              },
            )}
          </div>
          <p className="view-note">
            <CalendarDays size={14} /> Calendar shows project start dates and
            current deadlines.
          </p>
        </>
      )}
    </>
  );
}
