import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import type { Project, Summary } from "../types";
import { Empty, label, money } from "./shared";

const colors: Record<string, string> = {
  PLANNED: "#94a3b8",
  IN_PROGRESS: "#2563eb",
  ON_HOLD: "#f59e0b",
  PENDING_APPROVAL: "#0ea5e9",
  COMPLETED: "#16a34a",
  CANCELLED: "#dc2626",
};
const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 12,
};
export function StatusChart({ summary }: { summary: Summary }) {
  const data = Object.entries(summary.byStatus).map(([status, value]) => ({
    name: label(status),
    status,
    value,
  }));
  return (
    <div className="status-chart-layout">
      <div className="donut-chart">
        {summary.total ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                isAnimationActive={false}
                data={data}
                dataKey="value"
                innerRadius={72}
                outerRadius={92}
                paddingAngle={3}
                stroke="none"
              >
                {data.map((d) => (
                  <Cell key={d.status} fill={colors[d.status] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-donut" />
        )}
        <div className="donut-label">
          <strong>{summary.total}</strong>
          <span>Total projects</span>
        </div>
      </div>
      <div className="chart-legend">
        {data.map((d) => (
          <div key={d.status}>
            <i style={{ background: colors[d.status] }} />
            <span>{d.name}</span>
            <strong>{d.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
export function BudgetChart({
  projects,
  currency,
}: {
  projects: Project[];
  currency: string;
}) {
  const data = [...projects]
    .sort((a, b) => Number(b.plannedBudget) - Number(a.plannedBudget))
    .slice(0, 6)
    .map((p) => ({
      name: p.code,
      project: p.name,
      plannedExact: p.plannedBudget,
      spentExact: p.actualExpenditure,
      Planned: Number(p.plannedBudget),
      Spent: Number(p.actualExpenditure),
    }));
  if (!data.length)
    return <Empty title="Budget insights start with your first project" />;
  return (
    <>
      <div className="inline-legend">
        <span>
          <i style={{ background: "#2563eb" }} />
          Planned budget
        </span>
        <span>
          <i style={{ background: "#93c5fd" }} />
          Actual expenditure
        </span>
        <small>{currency} · 6 largest budgets</small>
      </div>
      <ResponsiveContainer width="100%" height={245}>
        <BarChart
          data={data}
          barGap={4}
          margin={{ left: 0, right: 8, top: 12 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={55}
            tickFormatter={(v) =>
              Intl.NumberFormat("en", { notation: "compact" }).format(v)
            }
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(_, payload) =>
              payload?.[0]?.payload?.project ?? ""
            }
            formatter={(_, name, item) =>
              money(
                name === "Planned"
                  ? item.payload.plannedExact
                  : item.payload.spentExact,
                currency,
              )
            }
          />
          <Bar
            isAnimationActive={false}
            dataKey="Planned"
            fill="#2563eb"
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
          />
          <Bar
            isAnimationActive={false}
            dataKey="Spent"
            fill="#93c5fd"
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
export function CompletionChart({ projects }: { projects: Project[] }) {
  const completed = projects.filter((p) => p.actualEndDate);
  if (!completed.length)
    return (
      <Empty title="No completed projects yet">
        <p>Accepted completions will appear here by month.</p>
      </Empty>
    );
  const months = new Map<string, number>();
  for (const p of completed) {
    const month = p.actualEndDate!.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + 1);
  }
  const data = [...months]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, Completed]) => ({ month, Completed }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 10, fill: "var(--muted)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          width={25}
          tick={{ fontSize: 10, fill: "var(--muted)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          isAnimationActive={false}
          type="monotone"
          dataKey="Completed"
          stroke="#2563eb"
          fill="#2563eb"
          fillOpacity={0.08}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
