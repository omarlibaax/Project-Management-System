import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, csrf, message, type Profile } from "../api";
import {
  type Page,
  type Project,
  type Schedule,
  type User,
  priorities,
} from "../types";
import {
  BackToProjects,
  Badge,
  Empty,
  ErrorNotice,
  Heading,
  Loading,
  label,
  money,
} from "../components/shared";
import { Button } from "../components/ui/button";
import Execution from "./Execution";
import { toast } from "sonner";
import ProjectExplorer from "./ProjectExplorer";

export const projectSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a project name").max(180),
    description: z.string().max(4000),
    category: z.string().trim().min(1, "Enter a category").max(120),
    location: z.string().trim().min(1, "Enter a location").max(240),
    client: z.string().trim().min(1, "Enter a client or department").max(180),
    managerId: z.string().min(1, "Select a project manager"),
    plannedStartDate: z.iso.date("Select a valid start date"),
    plannedEndDate: z.iso.date("Select a valid end date"),
    priority: z.enum(priorities),
    status: z.enum(["PLANNED", "IN_PROGRESS", "ON_HOLD", "CANCELLED"]),
    plannedBudget: z
      .string()
      .regex(
        /^\d{1,17}(\.\d{1,2})?$/,
        "Enter a non-negative amount with up to two decimal places",
      ),
    scheduleChangeReason: z.string().max(1000),
  })
  .refine((v) => v.plannedEndDate >= v.plannedStartDate, {
    message: "End date must be on or after start date",
    path: ["plannedEndDate"],
  });
type ProjectValues = z.infer<typeof projectSchema>;
const isManager = (user: Profile) =>
  user.roles.some((r) => ["ADMIN", "SUPER_ADMIN"].includes(r));

export function ProjectsPage({ user, mine = false }: { user: Profile; mine?: boolean }) {
  return <ProjectExplorer user={user} mine={mine} />;
}

function ProjectEditor({
  project,
  user,
}: {
  project?: Project;
  user: Profile;
}) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const managers = useQuery({
    queryKey: ["managers"],
    queryFn: async () => (await api.get<Page<User>>("/managers")).data,
  });
  const settings = useQuery({
    queryKey: ["workspace"],
    queryFn: async () =>
      (await api.get<{ currency: string }>("/workspace")).data,
  });
  const form = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name ?? "",
      description: project?.description ?? "",
      category: project?.category ?? "",
      location: project?.location ?? "",
      client: project?.client ?? "",
      managerId: String(project?.managerId ?? user.id),
      plannedStartDate: project?.plannedStartDate ?? "",
      plannedEndDate: project?.plannedEndDate ?? "",
      priority: project?.priority ?? "MEDIUM",
      status: (project?.status ?? "PLANNED") as ProjectValues["status"],
      plannedBudget: project?.plannedBudget ?? "0.00",
      scheduleChangeReason: "",
    },
  });
  const field = (name: keyof ProjectValues, title: string, type = "text") => (
    <div className={name === "name" ? "span-two" : ""}>
      <label htmlFor={name}>{title}</label>
      <input
        id={name}
        type={type}
        {...form.register(name)}
        aria-invalid={!!form.formState.errors[name]}
      />
      {form.formState.errors[name] && (
        <p className="error" role="alert">
          {form.formState.errors[name]?.message}
        </p>
      )}
    </div>
  );
  return (
    <>
      <BackToProjects />
      <Heading
        title={project ? "Edit project" : "Create project"}
        description="Build a clear plan for the work ahead."
      />
      <form
        className="panel project-form"
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          setError("");
          try {
            const payload = {
              ...values,
              managerId: Number(values.managerId),
              version: project?.version,
            };
            const result = project
              ? await api.put<Project>(`/projects/${project.id}`, payload, {
                  headers: await csrf(),
                })
              : await api.post<Project>("/projects", payload, {
                  headers: await csrf(),
                });
            await Promise.all([
              client.invalidateQueries({ queryKey: ["projects"] }),
              client.invalidateQueries({
                queryKey: ["project", result.data.id],
              }),
              client.invalidateQueries({ queryKey: ["dashboard"] }),
            ]);
            toast.success(project ? "Project updated" : "Project created");
            navigate(`/projects/${result.data.id}`);
          } catch (e) {
            setError(message(e));
          }
        })}
      >
        <div className="form-grid">
          {field("name", "Project name")}
          {field("category", "Category / type")}
          {field("location", "Location")}
          {field("client", "Client / department")}
          <div>
            <label htmlFor="managerId">Project manager</label>
            <select
              id="managerId"
              {...form.register("managerId")}
              disabled={managers.isPending}
            >
              <option value="">Select a manager</option>
              {managers.data?.items.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
            {managers.isError && (
              <ErrorNotice
                error={managers.error}
                retry={() => managers.refetch()}
              />
            )}
            <p className="error">{form.formState.errors.managerId?.message}</p>
          </div>
          {field("plannedStartDate", "Planned start date", "date")}
          {field("plannedEndDate", "Planned end date", "date")}
          <div>
            <label htmlFor="priority">Priority</label>
            <select id="priority" {...form.register("priority")}>
              {priorities.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status">Status</label>
            <select id="status" {...form.register("status")}>
              {["PLANNED", "IN_PROGRESS", "ON_HOLD", "CANCELLED"].map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </div>
          {field(
            "plannedBudget",
            `Planned budget${settings.data ? ` (${settings.data.currency})` : ""}`,
          )}
          <div className="span-two">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={4}
              {...form.register("description")}
            />
            <p className="error">
              {form.formState.errors.description?.message}
            </p>
          </div>
          {project && (
            <div className="span-two">
              <label htmlFor="scheduleChangeReason">
                Schedule change reason
              </label>
              <textarea
                id="scheduleChangeReason"
                rows={2}
                {...form.register("scheduleChangeReason")}
              />
              <small className="muted">
                Required when changing planned dates. Original dates remain in
                history.
              </small>
            </div>
          )}
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <Button variant="outline" asChild>
            <Link to={project ? `/projects/${project.id}` : "/projects"}>
              Cancel
            </Link>
          </Button>
          <Button
            disabled={
              form.formState.isSubmitting ||
              managers.isPending ||
              managers.isError
            }
          >
            {form.formState.isSubmitting
              ? "Saving..."
              : project
                ? "Save changes"
                : "Create project"}
          </Button>
        </div>
      </form>
    </>
  );
}
export function ProjectFormPage({ user }: { user: Profile }) {
  const { id } = useParams();
  const project = useQuery({
    queryKey: ["project", Number(id)],
    queryFn: async () => (await api.get<Project>(`/projects/${id}`)).data,
    enabled: !!id && isManager(user),
  });
  if (!isManager(user)) return <Empty title="Management access required" />;
  if (id && project.isPending) return <Loading />;
  if (id && project.isError)
    return (
      <ErrorNotice error={project.error} retry={() => project.refetch()} />
    );
  if (
    project.data &&
    (project.data.archived ||
      ["COMPLETED", "PENDING_APPROVAL", "CANCELLED"].includes(
        project.data.status,
      ))
  )
    return (
      <>
        <BackToProjects />
        <Empty title="This project is read-only" />
      </>
    );
  return (
    <ProjectEditor
      key={project.data?.id ?? "new"}
      project={project.data}
      user={user}
    />
  );
}
export function ProjectDetailPage({ user }: { user: Profile }) {
  const { id } = useParams();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const project = useQuery({
    queryKey: ["project", Number(id)],
    queryFn: async () => (await api.get<Project>(`/projects/${id}`)).data,
  });
  const history = useQuery({
    queryKey: ["schedule", Number(id)],
    queryFn: async () =>
      (await api.get<Schedule[]>(`/projects/${id}/schedule-history`)).data,
    enabled: !!project.data,
  });
  const settings = useQuery({
    queryKey: ["workspace"],
    queryFn: async () =>
      (await api.get<{ currency: string }>("/workspace")).data,
  });
  if (project.isPending) return <Loading />;
  if (project.isError)
    return (
      <ErrorNotice error={project.error} retry={() => project.refetch()} />
    );
  const p = project.data;
  const editable =
    isManager(user) &&
    !p.archived &&
    !["COMPLETED", "PENDING_APPROVAL", "CANCELLED"].includes(p.status);
  return (
    <>
      <BackToProjects />
      <Heading title={p.name} description={`${p.code} / ${p.location}`}>
        {editable && (
          <Button asChild>
            <Link to={`/projects/${p.id}/edit`}>Edit project</Link>
          </Button>
        )}
        {isManager(user) && !p.archived && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              if (
                !window.confirm(
                  "Archive this project? Its records will remain available in the archived list.",
                )
              )
                return;
              setBusy(true);
              setError("");
              try {
                await api.patch(
                  `/projects/${p.id}/archive`,
                  { version: p.version },
                  { headers: await csrf() },
                );
                await Promise.all([
                  client.invalidateQueries({ queryKey: ["project", p.id] }),
                  client.invalidateQueries({ queryKey: ["projects"] }),
                  client.invalidateQueries({ queryKey: ["dashboard"] }),
                ]);
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Archive project
          </Button>
        )}
      </Heading>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <div className="project-badges">
        <Badge value={p.status} />
        <Badge value={p.priority} />
        <Badge value={p.scheduleCondition} />
        {p.archived && <span className="badge">Archived</span>}
      </div>
      <nav className="project-section-nav" aria-label="Project sections">
        <a href="#overview">Overview</a><a href="#tasks">Tasks & progress</a><a href="#resources">Labour & materials</a><a href="#approvals">Requests & approvals</a>
      </nav>
      <div className="dashboard-columns" id="overview">
        <section className="panel">
          <h2>Project overview</h2>
          <p className="project-description">
            {p.description || "No description provided."}
          </p>
          <dl className="detail-list">
            <div>
              <dt>Category</dt>
              <dd>{p.category}</dd>
            </div>
            <div>
              <dt>Client / department</dt>
              <dd>{p.client}</dd>
            </div>
            <div>
              <dt>Project manager</dt>
              <dd>{p.managerName}</dd>
            </div>
            <div>
              <dt>Created by</dt>
              <dd>{p.createdBy}</dd>
            </div>
            <div>
              <dt>Progress</dt>
              <dd>{p.progress}%</dd>
            </div>
          </dl>
          <progress
            max={100}
            value={p.progress}
            aria-label="Project progress"
          />
          <p className="muted">Progress is weighted by each task's approved progress.</p>
        </section>
        <section className="panel">
          <h2>Schedule & planning</h2>
          <dl className="detail-list">
            <div>
              <dt>Planned start</dt>
              <dd>{p.plannedStartDate}</dd>
            </div>
            <div>
              <dt>Planned end</dt>
              <dd>{p.plannedEndDate}</dd>
            </div>
            <div>
              <dt>Duration (inclusive)</dt>
              <dd>{p.plannedDuration} days</dd>
            </div>
            <div>
              <dt>Actual start</dt>
              <dd>{p.actualStartDate ?? "Not started"}</dd>
            </div>
            <div>
              <dt>Original end</dt>
              <dd>{p.originalEndDate}</dd>
            </div>
            <div>
              <dt>Planned budget</dt>
              <dd>{money(p.plannedBudget, settings.data?.currency ?? "")}</dd>
            </div>
          </dl>
        </section>
      </div>
      <Execution project={p} user={user} />
      <section className="panel">
        <h2>Schedule history</h2>
        {history.isPending ? (
          <Loading />
        ) : history.isError ? (
          <ErrorNotice error={history.error} retry={() => history.refetch()} />
        ) : history.data.length === 0 ? (
          <Empty title="The original schedule is unchanged" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Changed</th>
                  <th>Previous dates</th>
                  <th>New dates</th>
                  <th>Reason</th>
                  <th>Authorized by</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.changedAt).toLocaleString()}</td>
                    <td>
                      {h.previousStart} to {h.previousEnd}
                    </td>
                    <td>
                      {h.newStart} to {h.newEnd}
                    </td>
                    <td>{h.reason}</td>
                    <td>{h.changedBy}</td>
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
