import { useState, lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, ShieldCheck, ArrowRight, HardHat } from "lucide-react";
import { api, csrf, login, message, type Profile } from "./api";
import { Button } from "./components/ui/button";
import WorkspaceLayout from "./components/WorkspaceLayout";
const OperationsPage = lazy(() => import("./pages/Operations"));
const SettingsPage = lazy(() => import("./pages/Settings"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProjectsPage = lazy(() =>
  import("./pages/Projects").then((m) => ({ default: m.ProjectsPage })),
);
const ProjectFormPage = lazy(() =>
  import("./pages/Projects").then((m) => ({ default: m.ProjectFormPage })),
);
const ProjectDetailPage = lazy(() =>
  import("./pages/Projects").then((m) => ({ default: m.ProjectDetailPage })),
);
const UsersPage = lazy(() => import("./pages/Users"));
const Notifications = lazy(() => import("./pages/Execution").then(m => ({ default: m.Notifications })));

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your username or email").max(254),
  password: z.string().min(1, "Enter your password"),
});
type Credentials = z.infer<typeof loginSchema>;
export function Login({ onLogin }: { onLogin: (user: Profile) => void }) {
  const [error, setError] = useState("");
  const form = useForm<Credentials>({ resolver: zodResolver(loginSchema) });
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <Building2 /> PMS <span>PROJECT MANAGEMENT</span>
        </div>
        <div>
          <p className="eyebrow">BUILT FOR THE WORK AHEAD</p>
          <h1>
            A stronger foundation
            <br />
            for every project.
          </h1>
          <p>One workspace for your people, plans, and progress.</p>
        </div>
        <p className="story-footer">
          <HardHat size={20} /> Construction & engineering workspace
        </p>
      </section>
      <main className="login-panel">
        <form
          onSubmit={form.handleSubmit(async (values) => {
            setError("");
            try {
              onLogin(await login(values.email, values.password));
            } catch (e) {
              setError(message(e));
            }
          })}
        >
          <span className="icon-tile">
            <ShieldCheck />
          </span>
          <p className="eyebrow">YOUR PROJECT WORKSPACE</p>
          <h2>Welcome back</h2>
          <p className="muted">Sign in with your organization account.</p>
          <label htmlFor="email">Username or email</label>
          <input
            id="email"
            type="text"
            autoComplete="username"
            placeholder="Username or email address"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p role="alert" className="error">
              {form.formState.errors.email.message}
            </p>
          )}
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p role="alert" className="error">
              {form.formState.errors.password.message}
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button disabled={form.formState.isSubmitting} className="full">
            {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
            <ArrowRight size={18} />
          </Button>
          <p className="account-note">
            Need access? Contact your system administrator.
          </p>
        </form>
        <small>Secure access · Organization accounts only</small>
      </main>
    </div>
  );
}
function ProfilePage({ signedOut }: { signedOut: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel narrow">
      <h2>Change password</h2>
      <p className="muted">
        Use 12–64 characters. Sign in again after changing it.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          try {
            await api.post(
              "/auth/password",
              {
                currentPassword: data.get("currentPassword"),
                newPassword: data.get("newPassword"),
              },
              { headers: await csrf() },
            );
            signedOut();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="current">Current password</label>
        <input
          id="current"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
        <label htmlFor="replacement">New password</label>
        <input
          id="replacement"
          name="newPassword"
          type="password"
          minLength={12}
          maxLength={64}
          autoComplete="new-password"
          required
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <Button disabled={busy}>Change password</Button>
      </form>
    </section>
  );
}
function Workspace({
  user,
  signedOut,
}: {
  user: Profile;
  signedOut: () => void;
}) {
  const manager = user.roles.some(r => ["ADMIN", "SUPER_ADMIN"].includes(r));
  return <WorkspaceLayout user={user} signedOut={signedOut}>
    <Suspense fallback={<p role="status" className="panel">Loading workspace...</p>}>
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/projects" element={<ProjectsPage user={user} />} />
        <Route path="/my-projects" element={<ProjectsPage user={user} mine />} />
        <Route path="/projects/new" element={<ProjectFormPage user={user} />} />
        <Route path="/projects/:id" element={<ProjectDetailPage user={user} />} />
        <Route path="/projects/:id/edit" element={<ProjectFormPage user={user} />} />
        <Route path="/users" element={user.roles.includes("SUPER_ADMIN") ? <UsersPage user={user} /> : <Navigate to="/" replace />} />
        <Route path="/engineers" element={manager ? <UsersPage user={user} directory /> : <Navigate to="/" replace />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<ProfilePage signedOut={signedOut} />} />
        <Route path="/settings" element={<SettingsPage user={user} />} />
        {["tasks", "labour", "materials", "budgets", "calendar", "reports", "approvals"].map(module => <Route key={module} path={'/'+module} element={(["budgets", "approvals"].includes(module) && !manager) ? <Navigate to="/" replace /> : <OperationsPage module={module} user={user} />} />)}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </WorkspaceLayout>;
}

export default function App() {
  const client = useQueryClient();
  const user = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return (await api.get<Profile>("/auth/me")).data;
      } catch (e) {
        if ((e as { response?: { status: number } }).response?.status === 401)
          return null;
        throw e;
      }
    },
  });
  if (user.isPending)
    return (
      <main className="center" role="status">
        Connecting to your workspace…
      </main>
    );
  if (user.isError)
    return (
      <main className="center">
        <h1>Workspace unavailable</h1>
        <p>Check that the backend and PostgreSQL are running.</p>
        <Button onClick={() => user.refetch()}>Try again</Button>
      </main>
    );
  if (!user.data)
    return (
      <Login onLogin={(profile) => client.setQueryData(["me"], profile)} />
    );
  return (
    <Workspace
      user={user.data}
      signedOut={() => {
        client.removeQueries({
          predicate: (query) => query.queryKey[0] !== "me",
        });
        client.setQueryData(["me"], null);
      }}
    />
  );
}
