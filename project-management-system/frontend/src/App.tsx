import { useState, lazy, Suspense } from "react";
import { Navigate, Route, Routes, NavLink } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  ArrowRight,
  HardHat,
  RefreshCw,
  FolderKanban,
  Users,
} from "lucide-react";
import { api, csrf, login, logout, message, type Profile } from "./api";
import { Button } from "./components/ui/button";

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

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
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
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@organization.com"
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
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const admin = user.roles.some((role) =>
    ["ADMIN", "SUPER_ADMIN"].includes(role),
  );
  return (
    <div className="app-shell">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <Building2 /> PMS <span>PROJECT MANAGEMENT</span>
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav onClick={() => setOpen(false)}>
          <NavLink to="/" end>
            <LayoutDashboard size={19} /> Overview
          </NavLink>
          <NavLink to="/projects">
            <FolderKanban size={19} /> {admin ? "All projects" : "My projects"}
          </NavLink>
          {admin && (
            <NavLink to="/engineers">
              <HardHat size={19} /> Engineers
            </NavLink>
          )}
          {user.roles.includes("SUPER_ADMIN") && (
            <NavLink to="/users">
              <Users size={19} /> Users
            </NavLink>
          )}
          <NavLink to="/profile">
            <UserRound size={19} /> My profile
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={20} />
          <div>
            Secure workspace<small>Role-based access enabled</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header>
          <Button
            variant="outline"
            className="mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            <Menu size={20} />
          </Button>
          <span className="header-org">
            Construction & Engineering <span>/ Project workspace</span>
          </span>
          <div className="header-user">
            <span className="avatar">{user.fullName.slice(0, 1)}</span>
            <span>
              {user.fullName}
              <small>{admin ? "Management" : "Engineer"}</small>
            </span>
            <Button
              variant="outline"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await logout();
                  signedOut();
                } catch (e) {
                  setError(message(e));
                }
              }}
            >
              <LogOut size={17} />
            </Button>
          </div>
        </header>
        <main className="content">
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Suspense fallback={<p role="status">Loading workspace...</p>}>
            <Routes>
              <Route path="/" element={<Dashboard user={user} />} />
              <Route path="/projects" element={<ProjectsPage user={user} />} />
              <Route
                path="/projects/new"
                element={<ProjectFormPage user={user} />}
              />
              <Route
                path="/projects/:id"
                element={<ProjectDetailPage user={user} />}
              />
              <Route
                path="/projects/:id/edit"
                element={<ProjectFormPage user={user} />}
              />
              <Route path="/users" element={<UsersPage user={user} />} />
              <Route
                path="/engineers"
                element={<UsersPage user={user} directory />}
              />
              <Route
                path="/profile"
                element={<ProfilePage signedOut={signedOut} />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <footer>
            PMS · Construction & engineering <span>Foundation workspace</span>
          </footer>
        </main>
      </div>
    </div>
  );
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
