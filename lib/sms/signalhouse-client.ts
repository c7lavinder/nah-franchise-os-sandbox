import { optionalEnv, requireEnv } from "@/lib/env";
import { toSignalHousePhone } from "@/lib/sms/phone";

const SIGNALHOUSE_BASE_URL = "https://v2.signalhouse.io";

export type SignalHouseMessageStatus =
  | "ENQUEUED"
  | "DEQUEUED"
  | "SENT"
  | "FAILED"
  | "DELIVERED"
  | "RECEIVED";

export interface SignalHouseMessage {
  _id: string;
  senderPhoneNumber?: string;
  phoneNumber?: string;
  messageType: "SMS" | "MMS" | "RCS" | "WHATSAPP" | "VIBER" | "P2P";
  direction: "INBOUND" | "OUTBOUND" | "inbound" | "outbound";
  recipientPhoneNumber?: string;
  messageBody?: string;
  segmentCount?: number;
  status?: SignalHouseMessageStatus | string;
  carrier?: string;
  carrierFamily?: string;
  carrierRegion?: string | null;
  statusCallbackUrl?: string;
  statusHistory?: Array<{ status: string; timestamp: string }>;
  cost?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface SendSmsInput {
  to: string;
  body: string;
  from?: string;
  statusCallbackUrl?: string;
  enableShortlink?: boolean;
  filterLandlinesAndInactiveNumbers?: boolean;
}

interface SendSmsResponse {
  insertedMessages: SignalHouseMessage[];
}

function getToken() {
  return requireEnv("SIGNALHOUSE_API_TOKEN");
}

function getFromNumber(inputFrom?: string) {
  return toSignalHousePhone(inputFrom || requireEnv("SIGNALHOUSE_FROM_NUMBER"));
}

async function signalHouseFetch<T>(endpoint: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${SIGNALHOUSE_BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SignalHouse API ${response.status} on ${endpoint}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export function signalHouseEnabled() {
  return process.env.SMS_PROVIDER === "signalhouse";
}

export async function sendSignalHouseSms(input: SendSmsInput): Promise<SignalHouseMessage> {
  const statusCallbackUrl =
    input.statusCallbackUrl || optionalEnv("SIGNALHOUSE_STATUS_CALLBACK_URL") || undefined;
  const response = await signalHouseFetch<SendSmsResponse>("/message/sms", {
    method: "POST",
    body: JSON.stringify({
      senderPhoneNumber: getFromNumber(input.from),
      recipientPhoneNumber: [toSignalHousePhone(input.to)],
      messageBody: input.body,
      statusCallbackUrl,
      enableShortlink: input.enableShortlink ?? false,
      filterLandlinesAndInactiveNumbers: input.filterLandlinesAndInactiveNumbers ?? false,
    }),
  });

  const message = response.insertedMessages?.[0];
  if (!message?._id) {
    throw new Error(`SignalHouse send returned no inserted message: ${JSON.stringify(response)}`);
  }

  return message;
}
