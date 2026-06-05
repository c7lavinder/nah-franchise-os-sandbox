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
