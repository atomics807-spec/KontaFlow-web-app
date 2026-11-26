import { AppError } from "./errors";

export const WORKSPACE_ROLES = ["owner", "admin", "accountant", "manager", "staff"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  accountant: "Accountant",
  manager: "Manager",
  staff: "Staff",
};

/** Ordered from most to least privileged; used for "at least this role" checks. */
export const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 50,
  admin: 40,
  accountant: 30,
  manager: 20,
  staff: 10,
};

export const PERMISSIONS = [
  "workspace:read",
  "workspace:update",
  "workspace:delete",
  "billing:manage",
  "members:read",
  "members:invite",
  "members:update",
  "members:remove",
  "transactions:read",
  "transactions:create",
  "transactions:update",
  "transactions:void",
  "contacts:read",
  "contacts:manage",
  "categories:read",
  "categories:manage",
  "accounts:read",
  "accounts:manage",
  "reports:read",
  "reports:export",
  "ai:use",
  "audit:read",
  "integrations:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  owner: ALL,
  admin: ALL.filter((permission) => permission !== "workspace:delete"),
  accountant: [
    "workspace:read",
    "members:read",
    "transactions:read",
    "transactions:create",
    "transactions:update",
    "transactions:void",
    "contacts:read",
    "contacts:manage",
    "categories:read",
    "categories:manage",
    "accounts:read",
    "reports:read",
    "reports:export",
    "ai:use",
  ],
  manager: [
    "workspace:read",
    "members:read",
    "transactions:read",
    "transactions:create",
    "transactions:update",
    "transactions:void",
    "contacts:read",
    "contacts:manage",
    "categories:read",
    "accounts:read",
    "reports:read",
    "ai:use",
  ],
  staff: [
    "workspace:read",
    "transactions:read",
    "transactions:create",
    "contacts:read",
    "categories:read",
    "accounts:read",
    "ai:use",
  ],
};

export function permissionsForRole(role: WorkspaceRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function can(role: WorkspaceRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(role: WorkspaceRole | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

export function assertCan(role: WorkspaceRole | null | undefined, permission: Permission): void {
  if (!can(role, permission)) {
    throw new AppError("forbidden", "You do not have permission to perform this action.");
  }
}

export function isAtLeast(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function parseRole(value: string | null | undefined): WorkspaceRole | null {
  const normalised = value?.trim().toLowerCase() ?? "";
  return (WORKSPACE_ROLES as readonly string[]).includes(normalised)
    ? (normalised as WorkspaceRole)
    : null;
}
