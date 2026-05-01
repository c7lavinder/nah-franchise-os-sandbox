"use client";

/**
 * PermissionsPanel — role-based permissions matrix displayed in Settings.
 * Shows which roles can perform which actions across the system.
 * Read-only (permissions are code-defined in lib/auth/permissions.ts).
 */

import { Check, X, Shield } from "lucide-react";
import { getPermissionsMatrix, ALL_ROLES, ROLE_LABELS, type PermissionEntry } from "@/lib/auth/permissions";
import type { UserRole } from "@/types/database";

/** Group permissions by their group name for sectioned display */
function groupPermissions(entries: PermissionEntry[]): Map<string, PermissionEntry[]> {
  const groups = new Map<string, PermissionEntry[]>();
  for (const entry of entries) {
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    groups.get(entry.group)!.push(entry);
  }
  return groups;
}

export default function PermissionsPanel() {
  const matrix = getPermissionsMatrix();
  const grouped = groupPermissions(matrix);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Shield size={16} className="text-nah-blue" />
        <h2 className="font-headline text-section-title text-text-primary">Permissions</h2>
      </div>
      <p className="text-body-sm text-text-tertiary mb-5">
        What each role can do across the system. Managed in code — contact an admin to change.
      </p>

      <div className="border border-border-default rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            {/* Header row with role names */}
            <thead>
              <tr className="bg-bg-secondary border-b border-border-default">
                <th className="px-4 py-3 text-body-sm font-semibold text-text-primary sticky left-0 bg-bg-secondary z-10 min-w-[200px]">
                  Action
                </th>
                {ALL_ROLES.map((role) => (
                  <th
                    key={role}
                    className="px-3 py-3 text-center text-caption font-semibold text-text-secondary min-w-[90px]"
                  >
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {Array.from(grouped.entries()).map(([group, entries], groupIdx) => (
                <GroupSection key={group} group={group} entries={entries} isLast={groupIdx === grouped.size - 1} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GroupSection({ group, entries, isLast }: { group: string; entries: PermissionEntry[]; isLast: boolean }) {
  return (
    <>
      {/* Group header */}
      <tr className="bg-bg-tertiary/50">
        <td
          colSpan={ALL_ROLES.length + 1}
          className="px-4 py-2 text-label-caps text-text-tertiary font-semibold tracking-wider"
        >
          {group.toUpperCase()}
        </td>
      </tr>

      {/* Permission rows */}
      {entries.map((entry, idx) => (
        <tr
          key={entry.action}
          className={idx === entries.length - 1 && !isLast ? "border-b border-border-default" : ""}
        >
          <td className="px-4 py-2.5 text-body-sm text-text-primary sticky left-0 bg-bg-primary z-10">{entry.label}</td>
          {ALL_ROLES.map((role) => (
            <PermissionCell key={role} allowed={entry.roles.includes(role)} />
          ))}
        </tr>
      ))}
    </>
  );
}

function PermissionCell({ allowed }: { allowed: boolean }) {
  return (
    <td className="px-3 py-2.5 text-center">
      {allowed ? (
        <Check size={16} className="inline-block text-success" />
      ) : (
        <X size={14} className="inline-block text-text-tertiary/40" />
      )}
    </td>
  );
}
