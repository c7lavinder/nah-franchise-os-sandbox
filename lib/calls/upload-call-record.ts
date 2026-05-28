import { createServerClient } from "@/lib/supabase/server";

export type UploadableCallRecord = {
  id: string;
  contact_id: string | null;
  sub_task_id: string | null;
  journey_pipeline_state_id: string | null;
  hosted_by_user_id: string | null;
};

export async function loadUploadableCall(
  supabase: ReturnType<typeof createServerClient>,
  callId: string
): Promise<UploadableCallRecord | null> {
  const { data: call } = await supabase
    .from("calls")
    .select("id, contact_id, sub_task_id, journey_pipeline_state_id, hosted_by_user_id")
    .eq("id", callId)
    .single();

  return call ?? null;
}
