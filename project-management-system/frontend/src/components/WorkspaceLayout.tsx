import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  HardHat,
  Hammer,
  Package,
  Wallet,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardCheck,
  Bell,
  Settings,
  UserRound,
  LogOut,
  Search,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { api, logout, message, type Profile } from "../api";
import { Button } from "./ui/button";

const workspaceLinks = [
  { to: "/", title: "Dashboard", Icon: LayoutDashboard },
  { to: "/projects", title: "All Projects", Icon: FolderKanban },
  { to: "/my-projects", title: "My Projects", Icon: FolderKanban },
  { to: "/tasks", title: "Tasks", Icon: ListTodo },
  { to: "/engineers", title: "Engineers / Team", Icon: HardHat, manager: true },
];
const operationsLinks = [
  { to: "/labour", title: "Labour", Icon: Hammer },
  { to: "/materials", title: "Materials", Icon: Package },
  { to: "/budgets", title: "Budgets", Icon: Wallet, manager: true },
  { to: "/calendar", title: "Calendar", Icon: CalendarDays },
  { to: "/reports", title: "Reports", Icon: ChartNoAxesCombined },
  { to: "/approvals", title: "Approvals", Icon: ClipboardCheck, manager: true },
];

export default function WorkspaceLayout({
  user,
  signedOut,
  children,
}: {
  user: Profile;
  signedOut: () => void;
  children: ReactNode;
}) {
  const manager = user.roles.some((r) => ["ADMIN", "SUPER_ADMIN"].includes(r));
  const location = useLocation();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("pms-sidebar") === "collapsed",
  );
  const [dark, setDark] = useState(
    () => localStorage.getItem("pms-theme") === "dark",
  );
  const [search, setSearch] = useState("");
  const drawer = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (
        await api.get<{ id: number; read_at: string | null }[]>(
          "/notifications",
        )
      ).data,
    refetchInterval: 60_000,
  });
  const unread = notifications.data?.filter((n) => !n.read_at).length ?? 0;
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("pms-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    localStorage.setItem("pms-sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);
  useEffect(() => {
    setMobile(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!mobile) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLElement>("a,button")?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobile(false);
        trigger.current?.focus();
      }
      if (e.key !== "Tab") return;
      const elements = Array.from(
        drawer.current?.querySelectorAll<HTMLElement>("a,button") ?? [],
      );
      const first = elements[0],
        last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keydown);
    };
  }, [mobile]);
  const allLinks = [
    ...workspaceLinks,
    ...operationsLinks,
    { to: "/notifications", title: "Notifications" },
    { to: "/users", title: "User administration" },
    { to: "/settings", title: "Settings" },
    { to: "/profile", title: "My profile" },
  ];
  const title =
    allLinks.find((l) => l.to === location.pathname)?.title ??
    (location.pathname.endsWith("/new") ? "New project" : "Project details");
  async function signOut() {
    try {
      await logout();
      signedOut();
    } catch (error) {
      toast.error(message(error));
    }
  }
  function navLinks(links: typeof workspaceLinks) {
    return links
      .filter((l) => !l.manager || manager)
      .filter((l) => l.to !== "/projects" || manager)
      .map(({ to, title, Icon }) => (
        <NavLink key={to} to={to} end title={collapsed ? title : undefined}>
          <Icon size={18} />
          <span>{title}</span>
        </NavLink>
      ));
  }
  return (
    <div className={`app-shell ${collapsed ? "is-collapsed" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobile && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation"
          onClick={() => {
            setMobile(false);
            trigger.current?.focus();
          }}
        />
      )}
      <aside
        ref={drawer}
        className={`sidebar ${mobile ? "open" : ""}`}
        aria-label="Workspace navigation"
      >
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Building2 size={23} />
          </span>
          <div>
            PMS<span>Project Management</span>
          </div>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => {
            setMobile(false);
            trigger.current?.focus();
          }}
        >
          <X size={20} />
        </button>
        <div className="workspace-switch">
          <span className="workspace-letter">CE</span>
          <div>
            Organization workspace<small>Construction & Engineering</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          <p className="nav-caption">WORKSPACE</p>
          {navLinks(workspaceLinks)}
          <p className="nav-caption">OPERATIONS</p>
          {navLinks(operationsLinks)}
          <p className="nav-caption">MANAGE</p>
          <NavLink
            to="/notifications"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span>Notifications</span>
            {unread > 0 && (
              <b className="nav-count" aria-hidden="true">
                {unread}
              </b>
            )}
          </NavLink>
          {user.roles.includes("SUPER_ADMIN") && (
            <NavLink to="/users" title="User administration">
              <UserRound size={18} />
              <span>User administration</span>
            </NavLink>
          )}
          <NavLink to="/settings" title="Settings">
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
          <NavLink to="/profile" title="My profile">
            <UserRound size={18} />
            <span>My profile</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{user.fullName.slice(0, 1)}</span>
          <div>
            {user.fullName}
            <small>{manager ? "Management" : "Engineer"}</small>
          </div>
          <button
            className="icon-button"
            onClick={signOut}
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
        <button
          className="collapse-control"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
          <span>Collapse sidebar</span>
        </button>
      </aside>
      <div className="main-shell">
        <header className="workspace-header">
          <button
            ref={trigger}
            className="mobile-menu icon-button"
            onClick={() => setMobile(!mobile)}
            aria-label="Toggle navigation"
            aria-expanded={mobile}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <Link to="/">Workspace</Link>
            <ChevronRight size={14} />
            <span>{title}</span>
          </div>
          <form
            className="global-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/projects?search=${encodeURIComponent(search.trim())}`);
            }}
          >
            <Search size={17} />
            <input
              aria-label="Search workspace projects"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={180}
            />
            <kbd>↵</kbd>
          </form>
          <div className="header-actions">
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <Link
              className="icon-button notification-button"
              to="/notifications"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            >
              <Bell size={19} />
              {unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}
            </Link>
            {manager && (
              <Button asChild className="quick-create">
                <Link to="/projects/new">
                  <Plus size={16} /> Create project
                </Link>
              </Button>
            )}
            <details className="profile-menu">
              <summary aria-label="Open profile menu">
                <span className="avatar">{user.fullName.slice(0, 1)}</span>
                <ChevronDown size={13} />
              </summary>
              <div className="profile-dropdown">
                <strong>{user.fullName}</strong>
                <small>{user.email}</small>
                <Link to="/profile">My profile</Link>
                <Link to="/settings">Workspace settings</Link>
                <button onClick={signOut}>
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            </details>
          </div>
        </header>
        <main className="content" id="main-content" tabIndex={-1}>
          {children}
          <footer>
            <span>
              © {new Date().getFullYear()} PMS · Project Management System
            </span>
            <span>Plan with clarity. Deliver with confidence.</span>
          </footer>
        </main>
      </div>
      <Toaster
        richColors
        closeButton
        position="bottom-right"
        theme={dark ? "dark" : "light"}
      />
    </div>
  );
}
