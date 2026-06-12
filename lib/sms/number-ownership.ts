import { createServerClient } from "@/lib/supabase/server";
import { phoneLookupKey, toSignalHousePhone } from "@/lib/sms/phone";

export const SIGNALHOUSE_NUMBER_OPTIONS = [
  { value: "18654215344", label: "Primary", display: "+1 (865) 421-5344" },
  { value: "18654215345", label: "Secondary", display: "+1 (865) 421-5345" },
];

export function normalizeSignalHouseNumber(value: string | null | undefined): string | null {
  const normalized = toSignalHousePhone(value);
  return normalized ? normalized : null;
}

export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = phoneLookupKey(a);
  const right = phoneLookupKey(b);
  return !!left && !!right && left === right;
}

export async function getAssignedSignalHouseNumber(userId: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("signalhouse_phone_number")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return normalizeSignalHouseNumber(data?.signalhouse_phone_number ?? null);
}

export async function findSignalHouseOwner(localNumber: string | null | undefined): Promise<string | null> {
  const normalized = phoneLookupKey(localNumber);
  if (!normalized) return null;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, signalhouse_phone_number")
    .not("signalhouse_phone_number", "is", null);

  if (error) throw error;
  const owner = (data ?? []).find((u) => samePhone(u.signalhouse_phone_number, normalized));
  return owner?.id ?? null;
}

export async function loadSignalHouseOwnerMap() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, signalhouse_phone_number")
    .not("signalhouse_phone_number", "is", null);

  if (error) throw error;
  return new Map(
    (data ?? []).map((u) => [
      phoneLookupKey(u.signalhouse_phone_number),
      {
        userId: u.id as string,
        name: u.full_name as string,
        number: normalizeSignalHouseNumber(u.signalhouse_phone_number),
      },
    ])
  );
}
