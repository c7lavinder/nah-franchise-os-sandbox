/** Display-friendly role labels. Maps DB role values to UI labels. */
const ROLE_LABELS: Record<string, string> = {
  leadership: "Admin",
  admin: "Admin",
  rep: "Rep",
  marketing: "Marketing",
  operator: "Operator",
  specialist: "Specialist",
  member: "Member",
};

export function formatRole(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role.toLowerCase()] ?? role;
}
