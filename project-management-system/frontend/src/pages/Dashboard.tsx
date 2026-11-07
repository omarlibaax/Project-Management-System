import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  Building2,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { api, type Profile } from "../api";
import type { Page, Project, Summary } from "../types";
import {
  Badge,
  Empty,
  ErrorNotice,
  Heading,
  Loading,
  money,
  label,
} from "../components/shared";
import { Button } from "../components/ui/button";

export default function Dashboard({ user }: { user: Profile }) {
  const admin = user.roles.some((r) => ["ADMIN", "SUPER_ADMIN"].includes(r));
  const summary = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<Summary>("/dashboard/admin")).data,
    enabled: admin,
  });
  const recent = useQuery({
    queryKey: ["projects", "recent"],
    queryFn: async () =>
      (
        await api.get<Page<Project>>("/projects", {
          params: { size: 5, sort: "createdAt", direction: "desc" },
        })
      ).data,
    enabled: admin,
  });
  if (!admin)
    return (
      <>
        <Heading
          title={`Welcome, ${user.fullName.split(" ")[0]}.`}
          description="Your engineering workspace"
        />
        <section className="panel">
          <h2>Assigned projects</h2>
          <Empty title="No assigned projects yet">
            <p>
              Project assignment management arrives in Phase 3. Your access
              remains limited to authorized projects.
            </p>
          </Empty>
        </section>
      </>
    );
  if (summary.isPending) return <Loading />;
  if (summary.isError)
    return (
      <ErrorNotice error={summary.error} retry={() => summary.refetch()} />
    );
  const data = summary.data;
  return (
    <>
      <Heading
        title={`Welcome, ${user.fullName.split(" ")[0]}.`}
        description="Your live project portfolio, schedules, and priorities."
      >
        <Button asChild>
          <Link to="/projects/new">Create project</Link>
        </Button>
      </Heading>
      <div className="kpi-grid">
        {[
          { name: "Total projects", value: data.total, Icon: Building2 },
          { name: "In progress", value: data.inProgress, Icon: Clock3 },
          { name: "Completed", value: data.completed, Icon: CheckCircle2 },
          { name: "Delayed", value: data.delayed, Icon: AlertTriangle },
        ].map(({ name, value, Icon }) => (
          <article className="panel kpi" key={name}>
            <div>
              <span className="muted">{name}</span>
              <strong>{value}</strong>
            </div>
            <Icon size={24} />
          </article>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <h2>Portfolio by status</h2>
          <p className="muted">
            Active portfolio, excluding archived projects.
          </p>
          {Object.entries(data.byStatus).map(([status, count]) => (
            <div className="status-row" key={status}>
              <span>{label(status)}</span>
              <div className="status-track">
                <span
                  style={{
                    width: `${data.total ? (count / data.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <strong>{count}</strong>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Planning snapshot</h2>
          <dl className="detail-list">
            <div>
              <dt>Planned budget</dt>
              <dd>{money(data.plannedBudget, data.currency)}</dd>
            </div>
            <div>
              <dt>Actual expenditure</dt>
              <dd>{money(data.actualExpenditure, data.currency)}</dd>
            </div>
            <div>
              <dt>High priority</dt>
              <dd>{data.highPriority} projects</dd>
            </div>
            <div>
              <dt>Pending approval</dt>
              <dd>{data.pendingApproval} projects</dd>
            </div>
          </dl>
          <p className="muted">
            Detailed budget approvals and expense recording arrive in Phase 4.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Recent projects</h2>
          <Link className="text-link" to="/projects">
            All projects <ArrowUpRight size={15} />
          </Link>
        </div>
        {recent.isPending ? (
          <Loading />
        ) : recent.isError ? (
          <ErrorNotice error={recent.error} retry={() => recent.refetch()} />
        ) : recent.data.items.length === 0 ? (
          <Empty title="Your first project starts here">
            <p>Create a project to begin building your portfolio.</p>
          </Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {recent.data.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="text-link" to={`/projects/${p.id}`}>
                        {p.name}
                      </Link>
                      <small>{p.code}</small>
                    </td>
                    <td>
                      <Badge value={p.status} />
                    </td>
                    <td>
                      <Badge value={p.priority} />
                    </td>
                    <td>{p.plannedEndDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
