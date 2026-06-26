/**
 * Centralized permissions map — single source of truth for role-based access.
 *
 * Instead of scattered `if (user.role !== "admin")` checks in every route,
 * all permissions are defined here and enforced by requireAuth.
 *
 * Usage in routes:
 *   const user = await requireAuth(request, "calls:delete");
 *   if (user instanceof Response) return user; // 401 or 403
 */

import type { UserRole } from "@/types/database";

/** Every permission action in the system */
export type PermissionAction =
  // Calls
  | "calls:read"
  | "calls:delete"
  | "calls:override"
  // Contacts
  | "contacts:read"
  | "contacts:write"
  | "contacts:messages"
  // Pipeline
  | "pipeline:read"
  | "pipeline:write"
  // Workflows
  | "workflows:read"
  | "workflows:write"
  | "workflows:approve"
  // Scout
  | "scout:use"
  // Daily HQ
  | "daily-hq:read"
  // Notifications
  | "notifications:read"
  | "notifications:write"
  // Settings (admin only)
  | "settings:read"
  | "settings:users"
  | "settings:pipelines"
  | "settings:call-types"
  | "settings:rubrics"
  | "settings:app-settings"
  | "settings:webhooks"
  | "settings:scout-logs";

/** The permissions matrix: action → which roles are allowed */
const PERMISSIONS: Record<PermissionAction, readonly UserRole[]> = {
  // ── Calls ──────────────────────────────────────────────
  "calls:read": ["admin", "operator", "leadership", "specialist", "rep", "marketing", "member"],
  "calls:delete": ["admin", "operator"],
  "calls:override": ["admin", "operator"],

  // ── Contacts ───────────────────────────────────────────
  "contacts:read": ["admin", "operator", "leadership", "specialist", "rep", "marketing", "member"],
  "contacts:write": ["admin", "operator", "rep", "member"],
  "contacts:messages": ["admin", "operator", "leadership", "specialist", "rep", "member"],

  // ── Pipeline ───────────────────────────────────────────
  "pipeline:read": ["admin", "operator", "leadership", "rep", "marketing", "member"],
  "pipeline:write": ["admin", "operator", "rep", "member"],

  // ── Workflows ──────────────────────────────────────────
  "workflows:read": ["admin", "operator", "leadership"],
  "workflows:write": ["admin", "operator"],
  "workflows:approve": ["admin"],

  // ── Scout ──────────────────────────────────────────────
  "scout:use": ["admin", "operator", "leadership", "specialist", "rep", "marketing", "member"],

  // ── Daily HQ ───────────────────────────────────────────
  "daily-hq:read": ["admin", "operator", "leadership", "specialist", "rep", "marketing", "member"],

  // ── Notifications ──────────────────────────────────────
  "notifications:read": ["admin", "operator", "leadership", "specialist", "rep", "marketing", "member"],
  "notifications:write": ["admin", "operator", "leadership", "specialist", "rep", "marketing", "member"],

  // ── Settings (admin only) ──────────────────────────────
  "settings:read": ["admin"],
  "settings:users": ["admin"],
  "settings:pipelines": ["admin"],
  "settings:call-types": ["admin"],
  "settings:rubrics": ["admin"],
  "settings:app-settings": ["admin"],
  "settings:webhooks": ["admin"],
  "settings:scout-logs": ["admin"],
};

/**
 * Check if a role has permission for an action.
 */
export function hasPermission(role: UserRole, action: PermissionAction): boolean {
  const allowed = PERMISSIONS[action];
  return allowed.includes(role);
}

/**
 * Get all permissions for a given role (for UI display).
 */
export function getPermissionsForRole(role: UserRole): PermissionAction[] {
  return (Object.keys(PERMISSIONS) as PermissionAction[]).filter((action) => PERMISSIONS[action].includes(role));
}

/**
 * Get the full permissions matrix (for Settings UI).
 * Returns an array of { action, label, group, roles } objects.
 */
export interface PermissionEntry {
  action: PermissionAction;
  label: string;
  group: string;
  roles: readonly UserRole[];
}

const ACTION_LABELS: Record<PermissionAction, { label: string; group: string }> = {
  "calls:read": { label: "View calls", group: "Calls" },
  "calls:delete": { label: "Delete calls", group: "Calls" },
  "calls:override": { label: "Override call data", group: "Calls" },
  "contacts:read": { label: "View contacts", group: "Contacts" },
  "contacts:write": { label: "Create/edit contacts", group: "Contacts" },
  "contacts:messages": { label: "Post messages on contacts", group: "Contacts" },
  "pipeline:read": { label: "View pipeline", group: "Pipeline" },
  "pipeline:write": { label: "Move contacts in pipeline", group: "Pipeline" },
  "workflows:read": { label: "View workflows", group: "Workflows" },
  "workflows:write": { label: "Create/edit workflows", group: "Workflows" },
  "workflows:approve": { label: "Approve workflow changes", group: "Workflows" },
  "scout:use": { label: "Use Scout AI", group: "Scout" },
  "daily-hq:read": { label: "View Daily HQ", group: "Daily HQ" },
  "notifications:read": { label: "View notifications", group: "Notifications" },
  "notifications:write": { label: "Mark notifications read", group: "Notifications" },
  "settings:read": { label: "View settings", group: "Settings" },
  "settings:users": { label: "Manage users", group: "Settings" },
  "settings:pipelines": { label: "Edit pipelines & stages", group: "Settings" },
  "settings:call-types": { label: "Edit call types", group: "Settings" },
  "settings:rubrics": { label: "Edit rubrics", group: "Settings" },
  "settings:app-settings": { label: "Change app settings", group: "Settings" },
  "settings:webhooks": { label: "Manage webhooks", group: "Settings" },
  "settings:scout-logs": { label: "View Scout logs", group: "Settings" },
};

export function getPermissionsMatrix(): PermissionEntry[] {
  return (Object.keys(PERMISSIONS) as PermissionAction[]).map((action) => ({
    action,
    label: ACTION_LABELS[action].label,
    group: ACTION_LABELS[action].group,
    roles: PERMISSIONS[action],
  }));
}

/** All roles in display order */
export const ALL_ROLES: readonly UserRole[] = [
  "admin",
  "operator",
  "leadership",
  "specialist",
  "rep",
  "marketing",
  "member",
];

/** Human-readable role labels */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  operator: "Operator",
  leadership: "Leadership",
  specialist: "Specialist",
  rep: "Rep",
  marketing: "Marketing",
  member: "Member",
};
