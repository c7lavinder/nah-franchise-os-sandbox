import { createServerClient } from "@/lib/supabase/server";
import { toSignalHousePhone } from "@/lib/sms/phone";

const EXTRA_NUMBER_ENV_KEYS = ["SIGNALHOUSE_FROM_NUMBER_2", "SIGNALHOUSE_FROM_NUMBER_3", "SIGNALHOUSE_FROM_NUMBER_4"];

export function normalizeAssignedSignalHouseNumber(value: string | null | undefined): string | null {
  const normalized = toSignalHousePhone(value);
  return normalized || null;
}

export function getConfiguredSignalHouseNumbers(): string[] {
  const values = [
    process.env.SIGNALHOUSE_FROM_NUMBER,
    ...EXTRA_NUMBER_ENV_KEYS.map((key) => process.env[key]),
    ...(process.env.SIGNALHOUSE_ADDITIONAL_FROM_NUMBERS ?? "").split(","),
  ];

  return Array.from(new Set(values.map(normalizeAssignedSignalHouseNumber).filter(Boolean) as string[]));
}

export async function getAssignedSignalHouseNumber(userId: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("assigned_signalhouse_number")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return normalizeAssignedSignalHouseNumber(data?.assigned_signalhouse_number);
}

// ─────────────────────────── Vonage ───────────────────────────
// Phone formatting (E.164 with US "1" prefix) is identical to SignalHouse, so
// normalizeAssignedSignalHouseNumber is reused for both providers.

const VONAGE_EXTRA_NUMBER_ENV_KEYS = ["VONAGE_FROM_NUMBER_2", "VONAGE_FROM_NUMBER_3", "VONAGE_FROM_NUMBER_4"];

export function getConfiguredVonageNumbers(): string[] {
  const values = [
    process.env.VONAGE_FROM_NUMBER,
    ...VONAGE_EXTRA_NUMBER_ENV_KEYS.map((key) => process.env[key]),
    ...(process.env.VONAGE_ADDITIONAL_FROM_NUMBERS ?? "").split(","),
  ];

  return Array.from(new Set(values.map(normalizeAssignedSignalHouseNumber).filter(Boolean) as string[]));
}

export async function getAssignedVonageNumber(userId: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("users").select("assigned_vonage_number").eq("id", userId).maybeSingle();

  if (error) throw error;
  return normalizeAssignedSignalHouseNumber(data?.assigned_vonage_number);
}

// ───────────────────── Provider-aware wrappers ─────────────────────
// Callers (inbox, send route, Scout executor) use these so swapping providers
// is a single SMS_PROVIDER change.

export type SmsProvider = "vonage" | "signalhouse" | "ghl";

export function getActiveSmsProvider(): SmsProvider {
  const provider = (process.env.SMS_PROVIDER ?? "").toLowerCase();
  if (provider === "vonage") return "vonage";
  if (provider === "signalhouse") return "signalhouse";
  return "ghl";
}

/** SMS providers whose history should appear in the in-app inbox. */
export function getInboxProviders(): SmsProvider[] {
  return ["vonage", "signalhouse"];
}

export const normalizeSmsNumber = normalizeAssignedSignalHouseNumber;

export function getConfiguredSmsNumbers(): string[] {
  return getActiveSmsProvider() === "vonage" ? getConfiguredVonageNumbers() : getConfiguredSignalHouseNumbers();
}

export async function getAssignedSmsNumber(userId: string): Promise<string | null> {
  return getActiveSmsProvider() === "vonage" ? getAssignedVonageNumber(userId) : getAssignedSignalHouseNumber(userId);
}
