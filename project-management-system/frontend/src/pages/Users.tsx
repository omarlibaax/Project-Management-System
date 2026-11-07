import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, csrf, message, type Profile } from "../api";
import type { Department, Page, User } from "../types";
import {
  Badge,
  Empty,
  ErrorNotice,
  Heading,
  Loading,
  Pagination,
} from "../components/shared";
import { Button } from "../components/ui/button";

const roles = ["SUPER_ADMIN", "ADMIN", "ENGINEER"] as const;
const baseUserSchema = z.object({
  fullName: z.string().trim().min(1, "Enter a full name").max(160),
  phone: z.string().max(40),
  position: z.string().max(120),
  departmentId: z.string(),
  roles: z.array(z.enum(roles)).min(1, "Select at least one role"),
});
export const createUserSchema = baseUserSchema.extend({
  employeeCode: z.string().trim().min(1, "Enter an employee code").max(40),
  email: z.email().max(254),
  password: z.string().min(12, "Use at least 12 characters").max(64),
});
type Values = z.infer<typeof createUserSchema>;
function UserEditor({
  user,
  viewer,
  close,
}: {
  user?: User;
  viewer: Profile;
  close: () => void;
}) {
  const client = useQueryClient();
  const [error, setError] = useState("");
  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await api.get<Department[]>("/departments")).data,
  });
  const schema = user
    ? createUserSchema.extend({ password: z.string() })
    : createUserSchema;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeCode: user?.employeeCode ?? "",
      fullName: user?.fullName ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
      position: user?.position ?? "",
      departmentId: user?.departmentId ? String(user.departmentId) : "",
      roles: (user?.roles ?? ["ENGINEER"]) as Values["roles"],
      password: "",
    },
  });
  const field = (
    name:
      "employeeCode" | "fullName" | "email" | "phone" | "position" | "password",
    title: string,
    type = "text",
  ) => (
    <div>
      <label htmlFor={`user-${name}`}>{title}</label>
      <input
        id={`user-${name}`}
        type={type}
        readOnly={!!user && ["employeeCode", "email"].includes(name)}
        autoComplete={name === "password" ? "new-password" : undefined}
        {...form.register(name)}
      />
      {form.formState.errors[name] && (
        <p role="alert" className="error">
          {form.formState.errors[name]?.message}
        </p>
      )}
    </div>
  );
  return (
    <section
      className="panel editor-panel"
      aria-label={user ? "Edit user" : "Create user"}
    >
      <div className="section-heading">
        <h2>{user ? "Edit user" : "Create user"}</h2>
        <Button variant="outline" onClick={close}>
          Close
        </Button>
      </div>
      <form
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          setError("");
          try {
            const common = {
              fullName: values.fullName,
              phone: values.phone,
              position: values.position,
              departmentId: values.departmentId
                ? Number(values.departmentId)
                : null,
              roles: values.roles,
            };
            if (user)
              await api.put(
                `/users/${user.id}`,
                { ...common, version: user.version },
                { headers: await csrf() },
              );
            else
              await api.post(
                "/users",
                {
                  ...common,
                  employeeCode: values.employeeCode,
                  email: values.email,
                  password: values.password,
                },
                { headers: await csrf() },
              );
            await Promise.all([
              client.invalidateQueries({ queryKey: ["users"] }),
              client.invalidateQueries({ queryKey: ["engineers"] }),
              client.invalidateQueries({ queryKey: ["managers"] }),
            ]);
            close();
          } catch (e) {
            setError(message(e));
          }
        })}
      >
        <div className="form-grid">
          {field("employeeCode", "Employee code")}
          {field("fullName", "Full name")}
          {field("email", "Email", "email")}
          {field("phone", "Phone")}
          {field("position", "Position")}
          <div>
            <label htmlFor="user-department">Department</label>
            <select id="user-department" {...form.register("departmentId")}>
              <option value="">No department</option>
              {departments.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {departments.isError && (
              <ErrorNotice
                error={departments.error}
                retry={() => departments.refetch()}
              />
            )}
          </div>
          {!user && field("password", "Initial password", "password")}
          <fieldset className="span-two">
            <legend>Roles</legend>
            {roles.map((role) => (
              <label className="checkbox-label" key={role}>
                <input
                  type="checkbox"
                  value={role}
                  {...form.register("roles")}
                />
                {role.replaceAll("_", " ")}
              </label>
            ))}
            <p className="error">{form.formState.errors.roles?.message}</p>
          </fieldset>
        </div>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <div className="form-footer">
          <Button variant="outline" type="button" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={
              form.formState.isSubmitting ||
              departments.isPending ||
              departments.isError
            }
          >
            {form.formState.isSubmitting
              ? "Saving..."
              : user
                ? "Save user"
                : "Create user"}
          </Button>
        </div>
      </form>
    </section>
  );
}
export default function UsersPage({
  user: viewer,
  directory = false,
}: {
  user: Profile;
  directory?: boolean;
}) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState(directory ? "true" : "");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [department, setDepartment] = useState("");
  const [departmentBusy, setDepartmentBusy] = useState(false);
  const permitted =
    viewer.roles.includes("SUPER_ADMIN") ||
    (directory && viewer.roles.includes("ADMIN"));
  const query = useQuery({
    queryKey: [
      directory ? "engineers" : "users",
      { search, role, active, page },
    ],
    queryFn: async () =>
      (
        await api.get<Page<User>>(directory ? "/engineers" : "/users", {
          params: {
            search,
            role: role || undefined,
            active: active || undefined,
            page,
            size: 20,
          },
        })
      ).data,
    enabled: permitted,
  });
  if (!permitted)
    return <Empty title="You do not have access to user administration" />;
  return (
    <>
      <Heading
        title={directory ? "Engineer directory" : "User management"}
        description={
          directory
            ? "Your organization’s engineering team."
            : "Create accounts, maintain roles, and manage access."
        }
      >
        {!directory && (
          <Button onClick={() => setEditing(null)}>Create user</Button>
        )}
      </Heading>
      {editing !== undefined && (
        <UserEditor
          key={editing?.id ?? "new"}
          user={editing ?? undefined}
          viewer={viewer}
          close={() => setEditing(undefined)}
        />
      )}
      <section className="panel">
        <div className="filters">
          <input
            aria-label="Search users"
            placeholder="Search name, email, employee code..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
          {!directory && (
            <select
              aria-label="Filter role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All roles</option>
              {roles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          )}
          <select
            aria-label="Filter account status"
            value={active}
            onChange={(e) => {
              setActive(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All accounts</option>
            <option value="true">Active</option>
            <option value="false">Suspended</option>
          </select>
        </div>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorNotice error={query.error} retry={() => query.refetch()} />
        ) : (
          <>
            {!query.data.items.length ? (
              <Empty title="No matching accounts" />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Contact</th>
                      <th>Department / position</th>
                      <th>Roles</th>
                      <th>Status</th>
                      {!directory && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.items.map((u) => (
                      <tr key={u.id}>
                        <td>
                          {u.fullName}
                          <small>{u.employeeCode}</small>
                        </td>
                        <td>
                          {u.email}
                          <small>{u.phone}</small>
                        </td>
                        <td>
                          {u.department ?? "Unassigned"}
                          <small>{u.position}</small>
                        </td>
                        <td>
                          <div className="tags">
                            {u.roles.map((r) => (
                              <span key={r}>{r.replaceAll("_", " ")}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <Badge value={u.active ? "ACTIVE" : "SUSPENDED"} />
                        </td>
                        {!directory && (
                          <td>
                            <div className="actions">
                              <Button
                                variant="outline"
                                onClick={() => setEditing(u)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                disabled={busy !== null || u.id === viewer.id}
                                onClick={async () => {
                                  if (
                                    !window.confirm(
                                      `${u.active ? "Suspend" : "Reactivate"} ${u.fullName}?`,
                                    )
                                  )
                                    return;
                                  setBusy(u.id);
                                  setError("");
                                  try {
                                    await api.patch(
                                      `/users/${u.id}/status`,
                                      { active: !u.active, version: u.version },
                                      { headers: await csrf() },
                                    );
                                    await Promise.all([
                                      client.invalidateQueries({
                                        queryKey: ["users"],
                                      }),
                                      client.invalidateQueries({
                                        queryKey: ["engineers"],
                                      }),
                                      client.invalidateQueries({
                                        queryKey: ["managers"],
                                      }),
                                    ]);
                                  } catch (e) {
                                    setError(message(e));
                                  } finally {
                                    setBusy(null);
                                  }
                                }}
                              >
                                {u.active ? "Suspend" : "Reactivate"}
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination {...query.data} onPage={setPage} />
          </>
        )}
      </section>
      {!directory && (
        <section className="panel department-panel">
          <h2>Add department</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setDepartmentBusy(true);
              try {
                await api.post(
                  "/departments",
                  { name: department.trim() },
                  { headers: await csrf() },
                );
                setDepartment("");
                await client.invalidateQueries({ queryKey: ["departments"] });
              } catch (err) {
                setError(message(err));
              } finally {
                setDepartmentBusy(false);
              }
            }}
          >
            <label htmlFor="new-department">Department name</label>
            <div className="actions">
              <input
                id="new-department"
                maxLength={120}
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
              <Button disabled={departmentBusy || !department.trim()}>
                Add department
              </Button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
