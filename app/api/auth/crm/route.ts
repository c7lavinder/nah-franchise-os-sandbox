export const dynamic = "force-dynamic";

/**
 * GET /api/auth/crm
 *
 * Starts the GHL OAuth flow by redirecting the user to the
 * GHL authorization page. User selects their sub-account,
 * grants permissions, and GHL redirects back to /api/auth/crm/callback.
 */

import { NextResponse } from "next/server";

const SCOPES = [
  "contacts.readonly",
  "contacts.write",
  "opportunities.readonly",
  "opportunities.write",
  "calendars.readonly",
  "calendars.write",
  "calendars/events.readonly",
  "calendars/events.write",
  "conversations.readonly",
  "conversations.write",
  "conversations/message.readonly",
  "conversations/message.write",
  "workflows.readonly",
  "locations.readonly",
  "locations/tags.readonly",
  "locations/tags.write",
  "locations/customValues.readonly",
  "locations/customValues.write",
  "locations/tasks.readonly",
  "locations/tasks.write",
  "users.readonly",
  "forms.readonly",
  "surveys.readonly",
  "invoices.readonly",
  "invoices.write",
  "payments/orders.readonly",
].join(" ");

export async function GET() {
  const clientId = process.env.GHL_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/crm/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: "GHL_CLIENT_ID is not configured" },
      { status: 500 }
    );
  }

  const authUrl = new URL("https://marketplace.gohighlevel.com/oauth/chooselocation");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", SCOPES);

  return NextResponse.redirect(authUrl.toString());
}
