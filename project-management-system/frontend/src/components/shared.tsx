import { Link } from "react-router";
import { Button } from "./ui/button";
import { message } from "../api";

export const label = (value: string) =>
  value === 'PLANNED' ? 'Not Started' : value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (s) => s.toUpperCase());
export function money(value: string, currency = "KES") {
  const negative = value.startsWith('-');
  const [whole, fraction = ""] = value.replace('-', '').split(".");
  return `${currency} ${negative ? '-' : ''}${new Intl.NumberFormat("en-KE").format(BigInt(whole || "0"))}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}
export function Badge({ value }: { value: string }) {
  return (
    <span className={`badge badge-${value.toLowerCase()}`}>{label(value)}</span>
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="notice error">
      <p>{message(error)}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <p role="status" className="panel">
      Loading workspace data...
    </p>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">PROJECT WORKSPACE</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total} records · Page {totalPages ? page + 1 : 0} of {totalPages}
      </span>
      <div className="actions">
        <Button
          variant="outline"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          disabled={page + 1 >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
export function BackToProjects() {
  return (
    <Link className="text-link" to="/projects">
      Back to projects
    </Link>
  );
}
