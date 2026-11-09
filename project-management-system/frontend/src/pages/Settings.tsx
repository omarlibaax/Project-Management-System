import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ShieldCheck, Globe, UserRound, ArrowUpRight } from "lucide-react";
import { api, type Profile } from "../api";
import { Heading, Loading, ErrorNotice, label } from "../components/shared";
import { Button } from "../components/ui/button";

export default function Settings({ user }: { user: Profile }) {
  const workspace = useQuery({
    queryKey: ["workspace"],
    queryFn: async () =>
      (await api.get<{ currency: string; timezone: string }>("/workspace"))
        .data,
  });
  return (
    <>
      <Heading
        title="Workspace settings"
        description="Your organization preferences and account security."
      />
      <div className="dashboard-columns">
        <section className="panel">
          <span className="icon-tile">
            <Globe size={22} />
          </span>
          <h2>Organization preferences</h2>
          {workspace.isPending ? (
            <Loading />
          ) : workspace.isError ? (
            <ErrorNotice
              error={workspace.error}
              retry={() => workspace.refetch()}
            />
          ) : (
            <dl className="detail-list">
              <div>
                <dt>Currency</dt>
                <dd>{workspace.data.currency}</dd>
              </div>
              <div>
                <dt>Timezone</dt>
                <dd>{workspace.data.timezone}</dd>
              </div>
            </dl>
          )}
          <p className="muted">
            Organization preferences are managed by your system administrator.
          </p>
        </section>
        <section className="panel">
          <span className="icon-tile">
            <ShieldCheck size={22} />
          </span>
          <h2>Account & security</h2>
          <dl className="detail-list">
            <div>
              <dt>Name</dt>
              <dd>{user.fullName}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user.roles.map(label).join(", ")}</dd>
            </div>
            <div>
              <dt>Employee code</dt>
              <dd>{user.employeeCode}</dd>
            </div>
          </dl>
          <Button asChild variant="outline">
            <Link to="/profile">
              <UserRound size={16} /> Change password <ArrowUpRight size={15} />
            </Link>
          </Button>
        </section>
      </div>
    </>
  );
}
