export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as ghl from "@/lib/ghl";
import { createServerClient } from "@/lib/supabase/server";
import { signalHouseEnabled } from "@/lib/sms/signalhouse-client";

function parseSignalHouseConversationId(conversationId: string) {
  if (conversationId.startsWith("sms:")) return { contactId: conversationId.slice(4), phone: null };
  if (conversationId.startsWith("smsphone:")) return { contactId: null, phone: conversationId.slice(9) };
  return null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const user = await requireAuth(request);
  if (user instanceof Response) return user;

  if (!signalHouseEnabled()) {
    try {
      await ghl.markConversationRead(conversationId);
    } catch {
      // Non-critical. The UI should still be allowed to open the thread.
    }
    return NextResponse.json({ success: true });
  }

  const parsed = parseSignalHouseConversationId(conversationId);
  if (!parsed) return NextResponse.json({ success: true });

  const supabase = createServerClient();
  let query = supabase
    .from("sms_messages")
    .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("direction", "inbound")
    .is("read_at", null);

  if (user.role !== "admin" && user.role !== "leadership") query = query.eq("owner_user_id", user.id);
  if (parsed.contactId) query = query.eq("contact_id", parsed.contactId);
  else if (parsed.phone) query = query.or(`from_number.ilike.%${parsed.phone},to_number.ilike.%${parsed.phone}`);

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
