import { createClient, SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

let client: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient {
  if (client) return client;

  client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false },
    // eslint-disable-next-line
    realtime: { transport: WebSocket as any },
  });

  return client;
}
