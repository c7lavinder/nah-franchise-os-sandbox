type EnvMap = Record<string, string | undefined>;

export type EnvKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "NEXT_PUBLIC_BASE_PATH"
  | "NEXT_PUBLIC_APP_URL"
  | "SUPABASE_SERVICE_KEY"
  | "SUPABASE_URL"
  | "MASTERSUITE_API_JWT_SECRET"
  | "MASTERSUITE_API_URL"
  | "CRON_SECRET"
  | "ANTHROPIC_API_KEY"
  | "OPENAI_API_KEY"
  | "VOYAGE_API_KEY"
  | "MASTERSUITE_DB_HOST"
  | "MASTERSUITE_DB_PORT"
  | "MASTERSUITE_DB_USER"
  | "MASTERSUITE_DB_PASSWORD"
  | "MASTERSUITE_DB_NAME"
  | "GHL_LOCATION_ID"
  | "GHL_CLIENT_ID"
  | "GHL_CLIENT_SECRET"
  | "GHL_API_KEY"
  | "GHL_SENDING_EMAIL"
  | "SMS_PROVIDER"
  | "SIGNALHOUSE_API_TOKEN"
  | "SIGNALHOUSE_FROM_NUMBER"
  | "SIGNALHOUSE_WEBHOOK_SECRET"
  | "SIGNALHOUSE_STATUS_CALLBACK_URL"
  | "VONAGE_API_KEY"
  | "VONAGE_API_SECRET"
  | "VONAGE_APPLICATION_ID"
  | "VONAGE_PRIVATE_KEY"
  | "VONAGE_API_SIGNATURE_SECRET"
  | "VONAGE_FROM_NUMBER"
  | "READ_AI_API_KEY";

export type EnvGroup = {
  name: string;
  required: EnvKey[];
  optional?: EnvKey[];
};

export const ENV_GROUPS: EnvGroup[] = [
  {
    name: "Core app / Supabase",
    required: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_KEY", "NEXT_PUBLIC_BASE_PATH"],
    optional: ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_URL"],
  },
  {
    name: "Auth / cron",
    required: ["MASTERSUITE_API_JWT_SECRET", "CRON_SECRET"],
    optional: ["MASTERSUITE_API_URL"],
  },
  {
    name: "Scout / AI",
    required: ["ANTHROPIC_API_KEY"],
    optional: ["OPENAI_API_KEY", "VOYAGE_API_KEY"],
  },
  {
    name: "MasterSuite sync",
    required: [
      "MASTERSUITE_DB_HOST",
      "MASTERSUITE_DB_PORT",
      "MASTERSUITE_DB_USER",
      "MASTERSUITE_DB_PASSWORD",
      "MASTERSUITE_DB_NAME",
    ],
  },
  {
    name: "GHL / Read.ai integrations",
    required: [],
    optional: ["GHL_LOCATION_ID", "GHL_CLIENT_ID", "GHL_CLIENT_SECRET", "READ_AI_API_KEY"],
  },
  {
    name: "SMS provider",
    required: [],
    optional: [
      "SMS_PROVIDER",
      "SIGNALHOUSE_API_TOKEN",
      "SIGNALHOUSE_FROM_NUMBER",
      "SIGNALHOUSE_WEBHOOK_SECRET",
      "SIGNALHOUSE_STATUS_CALLBACK_URL",
      "VONAGE_API_KEY",
      "VONAGE_API_SECRET",
      "VONAGE_APPLICATION_ID",
      "VONAGE_PRIVATE_KEY",
      "VONAGE_API_SIGNATURE_SECRET",
      "VONAGE_FROM_NUMBER",
    ],
  },
];

export function envValue(key: EnvKey, env: EnvMap = process.env): string | undefined {
  const value = env[key];
  return value && value.length > 0 ? value : undefined;
}

export function requireEnv(key: EnvKey, env: EnvMap = process.env): string {
  const value = envValue(key, env);
  if (!value) throw new Error(`Missing ${key} environment variable`);
  return value;
}

export function optionalEnv(key: EnvKey, fallback = "", env: EnvMap = process.env): string {
  return envValue(key, env) ?? fallback;
}

export function missingEnv(keys: EnvKey[], env: EnvMap = process.env): EnvKey[] {
  return keys.filter((key) => !envValue(key, env));
}

export function isDevelopment(env: EnvMap = process.env): boolean {
  return env.NODE_ENV === "development";
}
