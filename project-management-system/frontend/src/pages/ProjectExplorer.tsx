import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Plus,
  Search,
  List,
  LayoutGrid,
  Columns3,
  GanttChart,
  ArrowUpRight,
  MapPin,
  SlidersHorizontal,
  FolderKanban,
} from "lucide-react";
import { api, type Profile } from "../api";
import { type Project, type Page, statuses, priorities } from "../types";
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
  dateLabel,
  subtractMoney,
  useExecutionPortfolio,
} from "../lib/portfolio";

const emptyProjects: Project[] = [];
const views = [
  { id: "table", name: "Table", Icon: List },
  { id: "grid", name: "Grid", Icon: LayoutGrid },
  { id: "board", name: "Board", Icon: Columns3 },
  { id: "timeline", name: "Timeline", Icon: GanttChart },
];

export default function ProjectExplorer({
  user,
  mine = false,
}: {
  user: Profile;
  mine?: boolean;
}) {
  const manager = user.roles.some((r) => ["ADMIN", "SUPER_ADMIN"].includes(r));
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [archived, setArchived] = useState(false);
  const [sort, setSort] = useState("createdAt:desc");
  const [view, setView] = useState("table");
  const [page, setPage] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [engineer, setEngineer] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = useQuery({
    queryKey: ["projects", { search, status, priority, archived, sort }],
    queryFn: async ({ signal }) => {
      const items: Project[] = [];
      let current = 0,
        totalPages = 1;
      do {
        const { data } = await api.get<Page<Project>>("/projects", {
          signal,
          params: {
            search,
            status: status || undefined,
            priority: priority || undefined,
            archived,
            sort:
              sort.split(":")[0] === "progress"
                ? "createdAt"
                : sort.split(":")[0],
            direction: sort.split(":")[1],
            size: 100,
            page: current,
          },
        });
        items.push(...data.items);
        totalPages = data.totalPages;
        current++;
      } while (current < totalPages);
      return items;
    },
  });
  const settings = useQuery({
    queryKey: ["workspace"],
    queryFn: async () =>
      (await api.get<{ currency: string }>("/workspace")).data,
  });
  const projects = query.data ?? emptyProjects;
  const executions = useExecutionPortfolio(projects);
  const executionPending =
    (advanced || !!engineer || mine) && executions.some((q) => q.isPending);
  const executionError =
    advanced || !!engineer || mine
      ? executions.find((q) => q.isError)
      : undefined;
  const workspaces = new Map(
    executions
      .flatMap((q) => q.data ?? [])
      .map((row) => [row.project.id, row.workspace]),
  );
  const engineers = [
    ...new Map(
      [...workspaces.values()].flatMap((w) =>
        w.assignments
          .filter((a) => !a.revoked_at)
          .map((a) => [a.engineer_id, a.full_name] as const),
      ),
    ).entries(),
  ];
  const filtered = projects.filter(
    (p) =>
      (!mine ||
        (manager
          ? p.managerId === user.id ||
            workspaces
              .get(p.id)
              ?.assignments.some(
                (a) => a.engineer_id === user.id && !a.revoked_at,
              )
          : true)) &&
      (!from || (p.revisedEndDate ?? p.plannedEndDate) >= from) &&
      (!to || p.plannedStartDate <= to) &&
      (!engineer ||
        workspaces
          .get(p.id)
          ?.assignments.some(
            (a) => String(a.engineer_id) === engineer && !a.revoked_at,
          )),
  );
  if (sort.startsWith("progress"))
    filtered.sort((a, b) =>
      sort.endsWith("asc") ? a.progress - b.progress : b.progress - a.progress,
    );
  const visible = filtered.slice(page * 20, page * 20 + 20);
  const currency = settings.data?.currency;
  const assignedByProject = new Map(
    [...workspaces].map(([id, w]) => [
      id,
      w.assignments
        .filter((a) => !a.revoked_at)
        .map((a) => a.full_name)
        .join(", "),
    ]),
  );
  const columns = useMemo<ColumnDef<Project>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Project",
        cell: ({ row: { original: p } }) => (
          <div className="project-table-name">
            <span className="project-symbol">
              <FolderKanban size={18} />
            </span>
            <div>
              <Link to={`/projects/${p.id}`} className="project-name">
                {p.name}
              </Link>
              <small>
                {p.code} · {p.location}
              </small>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "managerName",
        header: "Manager",
        cell: ({ getValue }) => <span>{String(getValue() ?? "—")}</span>,
      },
      {
        id: "engineers",
        header: "Assigned engineers",
        cell: ({ row }) => (
          <span>
            {assignedByProject.get(row.original.id) ||
              (executions.some((q) => q.isPending)
                ? "Loading…"
                : executions.some((q) => q.isError)
                  ? "Unavailable"
                  : "Unassigned")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge value={row.original.status} />,
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => <Badge value={row.original.priority} />,
      },
      {
        accessorKey: "progress",
        header: "Progress",
        cell: ({ row }) => (
          <div className="table-progress">
            <span>{row.original.progress}%</span>
            <progress
              value={row.original.progress}
              max={100}
              aria-label={`${row.original.name} progress`}
            />
          </div>
        ),
      },
      {
        accessorKey: "plannedEndDate",
        header: "Deadline",
        cell: ({ row }) => (
          <>
            <span>
              {dateLabel(
                row.original.revisedEndDate ?? row.original.plannedEndDate,
              )}
            </span>
            {row.original.scheduleCondition === "DELAYED" && (
              <small className="danger-text">Overdue</small>
            )}
          </>
        ),
      },
      {
        accessorKey: "plannedStartDate",
        header: "Start / duration",
        cell: ({ row }) => (
          <>
            {dateLabel(row.original.plannedStartDate)}
            <small>{row.original.plannedDuration} days</small>
          </>
        ),
      },
      {
        accessorKey: "plannedBudget",
        header: "Budget / spent",
        cell: ({ row }) => (
          <>
            <span>
              {currency
                ? money(row.original.plannedBudget, currency)
                : row.original.plannedBudget}
            </span>
            <small>
              {currency
                ? money(row.original.actualExpenditure, currency)
                : row.original.actualExpenditure}{" "}
              spent
            </small>
          </>
        ),
      },
      {
        id: "remaining",
        header: "Approved remaining",
        cell: ({ row }) => (
          <span>
            {currency
              ? money(
                  subtractMoney(
                    row.original.approvedBudget,
                    row.original.actualExpenditure,
                  ),
                  currency,
                )
              : subtractMoney(
                  row.original.approvedBudget,
                  row.original.actualExpenditure,
                )}
          </span>
        ),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => dateLabel(row.original.updatedAt),
      },
      {
        id: "open",
        header: "",
        cell: ({ row }) => (
          <Link
            className="icon-button"
            aria-label={`Open ${row.original.name}`}
            to={`/projects/${row.original.id}`}
          >
            <ArrowUpRight size={17} />
          </Link>
        ),
      },
    ],
    [currency, assignedByProject],
  );
  const table = useReactTable({
    data: visible,
    columns,
    manualPagination: true,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
  });
  const changeView = (value: string) => {
    setView(value);
    setPage(0);
  };
  const clear = () => {
    setParams({});
    setStatus("");
    setPriority("");
    setEngineer("");
    setFrom("");
    setTo("");
    setPage(0);
  };
  return (
    <>
      <Heading
        title={mine || !manager ? "My projects" : "All projects"}
        description="Every project. A clearer perspective on what comes next."
      >
        {manager && (
          <Button asChild>
            <Link to="/projects/new">
              <Plus size={17} /> Create project
            </Link>
          </Button>
        )}
      </Heading>
      <div className="portfolio-tabs">
        <span className="active">
          {archived ? "Archived portfolio" : "Project portfolio"}{" "}
          <b>{query.data ? filtered.length : "—"}</b>
        </span>
        <span className="muted">
          {mine
            ? "Projects you manage or are assigned to"
            : "Your organization’s accessible projects"}
        </span>
      </div>
      <section className="panel explorer-panel">
        <div className="explorer-toolbar">
          <div className="view-switch" role="group" aria-label="Project view">
            {views.map(({ id, name, Icon }) => (
              <button
                key={id}
                aria-pressed={view === id}
                onClick={() => changeView(id)}
              >
                <Icon size={16} />
                <span>{name}</span>
              </button>
            ))}
          </div>
          <button
            className={`filter-toggle ${advanced ? "selected" : ""}`}
            onClick={() => setAdvanced(!advanced)}
            aria-expanded={advanced}
          >
            <SlidersHorizontal size={15} /> More filters
          </button>
        </div>
        <div className="filters">
          <label className="search-control">
            <Search size={17} />
            <input
              aria-label="Search projects"
              placeholder="Search by name, code or location…"
              maxLength={180}
              value={search}
              onChange={(e) => {
                setParams(e.target.value ? { search: e.target.value } : {});
                setPage(0);
              }}
            />
          </label>
          <select
            aria-label="Filter status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option value={s} key={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter priority"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All priorities</option>
            {priorities.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort projects"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
          >
            <option value="createdAt:desc">Recently created</option>
            <option value="plannedEndDate:asc">Deadline: earliest</option>
            <option value="name:asc">Name: A–Z</option>
            <option value="name:desc">Name: Z–A</option>
            <option value="progress:desc">Progress: highest</option>
          </select>
        </div>
        {advanced && (
          <div className="advanced-filters">
            <label>
              Assigned engineer
              <select
                aria-label="Filter engineer"
                value={engineer}
                onChange={(e) => {
                  setEngineer(e.target.value);
                  setPage(0);
                }}
                disabled={executionPending}
              >
                <option value="">All engineers</option>
                {engineers.map(([id, name]) => (
                  <option value={id} key={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Schedule overlaps from
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              Through
              <input
                type="date"
                min={from}
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            {manager && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(e) => {
                    setArchived(e.target.checked);
                    setPage(0);
                  }}
                />
                Archived only
              </label>
            )}
            <Button variant="outline" onClick={clear}>
              Reset filters
            </Button>
          </div>
        )}
        {query.isPending || executionPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorNotice error={query.error} retry={() => query.refetch()} />
        ) : executionError ? (
          <ErrorNotice
            error={executionError.error}
            retry={() => executionError.refetch()}
          />
        ) : !filtered.length ? (
          <Empty title="No projects found">
            <p>
              {manager
                ? "Create a project to get started, or adjust your filters."
                : "Your assigned projects will appear here."}
            </p>
            {manager && (
              <Button asChild>
                <Link to="/projects/new">
                  <Plus size={16} /> Create your first project
                </Link>
              </Button>
            )}
          </Empty>
        ) : (
          <>
            {view === "table" && (
              <div className="table-scroll">
                <table>
                  <thead>
                    {table.getHeaderGroups().map((group) => (
                      <tr key={group.id}>
                        {group.headers.map((header) => (
                          <th key={header.id} scope="col">
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {view === "grid" && (
              <div className="project-grid">
                {visible.map((p) => (
                  <ProjectCard key={p.id} project={p} currency={currency} />
                ))}
              </div>
            )}
            {view === "board" && (
              <div className="kanban-board">
                {statuses.map((status) => (
                  <section className="kanban-column" key={status}>
                    <h3>
                      <Badge value={status} />
                      <span>
                        {filtered.filter((p) => p.status === status).length}
                      </span>
                    </h3>
                    {filtered
                      .filter((p) => p.status === status)
                      .map((p) => (
                        <ProjectCard
                          key={p.id}
                          project={p}
                          currency={currency}
                        />
                      ))}
                    {!filtered.some((p) => p.status === status) && (
                      <p className="muted board-empty">No projects</p>
                    )}
                  </section>
                ))}
              </div>
            )}
            {view === "timeline" && <Timeline projects={filtered} />}
            {(view === "table" || view === "grid") && (
              <Pagination
                page={page}
                total={filtered.length}
                totalPages={Math.ceil(filtered.length / 20)}
                onPage={setPage}
              />
            )}
            {view === "board" && (
              <p className="view-note">
                Open a project to change its status. Completion and approval
                follow the project review workflow.
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}

export function ProjectCard({
  project: p,
  currency,
}: {
  project: Project;
  currency?: string;
}) {
  return (
    <article className="project-card">
      <div className="section-heading">
        <span className="project-symbol">
          <FolderKanban size={19} />
        </span>
        <Badge value={p.priority} />
      </div>
      <small>{p.code}</small>
      <h3>
        <Link to={`/projects/${p.id}`}>{p.name}</Link>
      </h3>
      <p className="project-card-description">
        {p.description || "No description provided."}
      </p>
      <p className="location-line">
        <MapPin size={13} />
        {p.location}
      </p>
      <div className="project-card-progress">
        <span>Progress</span>
        <strong>{p.progress}%</strong>
      </div>
      <progress
        max={100}
        value={p.progress}
        aria-label={`${p.name} progress`}
      />
      <div className="card-metadata">
        <Badge value={p.status} />
        <span>{dateLabel(p.revisedEndDate ?? p.plannedEndDate)}</span>
      </div>
      <dl className="card-financials">
        <div>
          <dt>Planned</dt>
          <dd>
            {currency ? money(p.plannedBudget, currency) : p.plannedBudget}
          </dd>
        </div>
        <div>
          <dt>Approved remaining</dt>
          <dd>
            {currency
              ? money(
                  subtractMoney(p.approvedBudget, p.actualExpenditure),
                  currency,
                )
              : subtractMoney(p.approvedBudget, p.actualExpenditure)}
          </dd>
        </div>
      </dl>
      <div className="card-owner">
        <span className="avatar">{p.managerName?.slice(0, 1) ?? "?"}</span>
        <span>{p.managerName}</span>
        <Link
          to={`/projects/${p.id}`}
          className="icon-button"
          aria-label={`Open ${p.name}`}
        >
          <ArrowUpRight size={17} />
        </Link>
      </div>
    </article>
  );
}

export function Timeline({ projects }: { projects: Project[] }) {
  const day = (s: string) => Date.parse(s.slice(0, 10) + "T12:00:00Z");
  const start = Math.min(...projects.map((p) => day(p.plannedStartDate)));
  const end = Math.max(
    ...projects.map((p) => day(p.revisedEndDate ?? p.plannedEndDate)),
  );
  const duration = Math.max(end - start, 86400000);
  return (
    <div className="timeline">
      <div className="timeline-scale">
        <span>{dateLabel(new Date(start).toISOString())}</span>
        <span>{dateLabel(new Date(end).toISOString())}</span>
      </div>
      {projects.map((p) => (
        <div className="timeline-row" key={p.id}>
          <Link to={`/projects/${p.id}`}>
            {p.name}
            <small>
              {dateLabel(p.plannedStartDate)} –{" "}
              {dateLabel(p.revisedEndDate ?? p.plannedEndDate)}
            </small>
          </Link>
          <div className="timeline-track">
            <Link
              to={`/projects/${p.id}`}
              className={`timeline-bar timeline-${p.status.toLowerCase()}`}
              style={{
                marginLeft: `${((day(p.plannedStartDate) - start) / duration) * 94}%`,
                width: `${Math.max(2, ((day(p.revisedEndDate ?? p.plannedEndDate) - day(p.plannedStartDate)) / duration) * 94)}%`,
              }}
              aria-label={`${p.name}, ${p.progress}% complete`}
            >
              {p.progress}%
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
