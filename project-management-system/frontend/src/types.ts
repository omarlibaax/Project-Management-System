export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
};
export type User = {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  department: string | null;
  departmentId: number | null;
  position: string | null;
  roles: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin: string | null;
  version: number;
};
export type Department = { id: number; name: string };
export const statuses = [
  "PLANNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "PENDING_APPROVAL",
  "COMPLETED",
  "CANCELLED",
] as const;
export const priorities = ["LOW", "MEDIUM", "HIGH"] as const;
export type Project = {
  id: number;
  code: string;
  name: string;
  description: string;
  category: string;
  location: string;
  client: string;
  managerId: number;
  managerName: string;
  plannedStartDate: string;
  plannedEndDate: string;
  originalStartDate: string;
  originalEndDate: string;
  plannedDuration: number;
  actualStartDate: string | null;
  actualEndDate: string | null;
  revisedEndDate: string | null;
  priority: (typeof priorities)[number];
  status: (typeof statuses)[number];
  scheduleCondition: string;
  plannedBudget: string;
  approvedBudget: string;
  actualExpenditure: string;
  progress: number;
  archived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};
export type Summary = {
  total: number;
  planned: number;
  inProgress: number;
  onHold: number;
  pendingApproval: number;
  completed: number;
  cancelled: number;
  delayed: number;
  highPriority: number;
  plannedBudget: string;
  actualExpenditure: string;
  currency: string;
  byStatus: Record<string, number>;
};
export type Schedule = {
  id: number;
  previousStart: string;
  previousEnd: string;
  newStart: string;
  newEnd: string;
  reason: string;
  changedBy: string;
  changedAt: string;
};
