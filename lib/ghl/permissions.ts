/**
 * GHL Action Permission Enforcement
 *
 * Checks user role before allowing any GHL action.
 * - Admin (Matt, Ryland, Corey): all 30 actions on any contact
 * - Operator (Chad): all 30 actions on his contacts
 * - Specialist (Sam, Mark, John): C1-C8, T1-T5, A1-A5 only
 * - Member: no GHL actions
 */

import { createServerClient } from "@/lib/supabase/server";

export type GHLActionCode =
  // Communication (8)
  | "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8"
  // Tasks (5)
  | "T1" | "T2" | "T3" | "T4" | "T5"
  // Calendar (5)
  | "A1" | "A2" | "A3" | "A4" | "A5"
  // Contact Management (9)
  | "M1" | "M2" | "M3" | "M4" | "M5" | "M6" | "M7" | "M8" | "M9"
  // Opportunities (3)
  | "O1" | "O2" | "O3";

/** Actions available to Specialist role */
const SPECIALIST_ACTIONS: GHLActionCode[] = [
  "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8",
  "T1", "T2", "T3", "T4", "T5",
  "A1", "A2", "A3", "A4", "A5",
];

/** All 30 actions */
const ALL_ACTIONS: GHLActionCode[] = [
  ...SPECIALIST_ACTIONS,
  "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9",
  "O1", "O2", "O3",
];

/** Human-readable action names */
export const ACTION_LABELS: Record<GHLActionCode, string> = {
  C1: "Send SMS",
  C2: "Send Email",
  C3: "Send Template SMS",
  C4: "Send Template Email",
  C5: "Add to Campaign",
  C6: "Remove from Campaign",
  C7: "Log Manual Call",
  C8: "Add Internal Note",
  T1: "Create Task",
  T2: "Update Task",
  T3: "Complete Task",
  T4: "Delete Task",
  T5: "Reassign Task",
  A1: "Schedule Appointment",
  A2: "Update Appointment",
  A3: "Cancel Appointment",
  A4: "Reschedule Appointment",
  A5: "Send Appointment Reminder",
  M1: "Create Contact",
  M2: "Update Contact Fields",
  M3: "Update Pipeline Stage",
  M4: "Add Tag",
  M5: "Remove Tag",
  M6: "Assign Contact",
  M7: "Mark as Lost",
  M8: "Mark as DNC",
  M9: "Delete Contact",
  O1: "Create Opportunity",
  O2: "Update Opportunity",
  O3: "Close Opportunity",
};

interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a user has permission to execute a GHL action.
 */
export async function checkActionPermission(
  userId: string,
  actionCode: GHLActionCode,
  contactId?: string
): Promise<PermissionCheckResult> {
  const supabase = createServerClient();

  // Fetch user role + real user flag
  const { data: user, error } = await supabase
    .from("users")
    .select("id, role, full_name, is_real_user")
    .eq("id", userId)
    .single();

  if (error || !user) {
    return { allowed: false, reason: "User not found" };
  }

  // Block placeholder users from all GHL actions
  if (!user.is_real_user) {
    return {
      allowed: false,
      reason: `${user.full_name} is a placeholder account. GHL actions are disabled until this account is activated.`,
    };
  }

  // Admin: all 30 actions on any contact
  if (user.role === "admin") {
    return { allowed: true };
  }

  // Operator: all 30 actions on assigned contacts
  if (user.role === "operator") {
    if (ALL_ACTIONS.includes(actionCode)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Action ${actionCode} is not available for operator role`,
    };
  }

  // Specialist: C1-C8, T1-T5, A1-A5 only
  if (user.role === "specialist") {
    if (SPECIALIST_ACTIONS.includes(actionCode)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `Your role (specialist) doesn't have access to ${ACTION_LABELS[actionCode]}. Contact management and opportunity actions require admin or operator role.`,
    };
  }

  // Member: no GHL actions
  return {
    allowed: false,
    reason: "Your role doesn't have access to GHL actions",
  };
}

/**
 * Get the list of allowed actions for a user role.
 */
export async function getAllowedActions(
  userId: string
): Promise<GHLActionCode[]> {
  const supabase = createServerClient();

  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  if (!user) return [];

  if (user.role === "admin" || user.role === "operator") {
    return ALL_ACTIONS;
  }
  if (user.role === "specialist") {
    return SPECIALIST_ACTIONS;
  }
  return [];
}
