import { useQuery, useQueries } from "@tanstack/react-query";
import { api } from "../api";
import type { Page, Project } from "../types";
import type { Workspace } from "../pages/Execution";

export function usePortfolio(archived = false) {
  return useQuery({
    queryKey: ["projects", "portfolio", archived],
    staleTime: 30_000,
    queryFn: async ({ signal }) => {
      const projects: Project[] = [];
      let page = 0;
      let totalPages = 1;
      do {
        const { data } = await api.get<Page<Project>>("/projects", {
          signal,
          params: { size: 100, page, archived },
        });
        projects.push(...data.items);
        totalPages = data.totalPages;
        page++;
      } while (page < totalPages);
      return projects;
    },
  });
}

export function useExecutionPortfolio(projects: Project[], enabled = true) {
  // At most six requests run concurrently, even as the portfolio grows.
  const lanes = Array.from(
    { length: Math.min(projects.length, 6) },
    (_, lane) => projects.filter((_, index) => index % 6 === lane),
  );
  return useQueries({
    queries: lanes.map((lane) => ({
      queryKey: ["execution", "portfolio", lane.map((p) => p.id)],
      staleTime: 30_000,
      enabled,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const results: { project: Project; workspace: Workspace }[] = [];
        for (const project of lane) {
          const { data } = await api.get<Workspace>(
            `/projects/${project.id}/execution`,
            { signal },
          );
          results.push({ project, workspace: data });
        }
        return results;
      },
    })),
  });
}

export function subtractMoney(a: string, b: string) {
  const cents = (value: string) => {
    const negative = value.startsWith("-");
    const [whole, fraction = ""] = value.replace("-", "").split(".");
    const result =
      BigInt(whole || "0") * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
    return negative ? -result : result;
  };
  const result = cents(a) - cents(b);
  const absolute = result < 0n ? -result : result;
  return `${result < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function sumMoney(values: string[]) {
  return values.reduce(
    (sum, value) =>
      subtractMoney(sum, value.startsWith("-") ? value.slice(1) : `-${value}`),
    "0.00",
  );
}

export function dateLabel(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value.slice(0, 10) + "T12:00:00Z"))
    : "—";
}

export function todayIn(timeZone = "Africa/Nairobi") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
