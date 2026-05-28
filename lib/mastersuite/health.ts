import { checkMSConnection } from "./client";

export type MasterSuiteEnvKey =
  | "MASTERSUITE_DB_HOST"
  | "MASTERSUITE_DB_PORT"
  | "MASTERSUITE_DB_USER"
  | "MASTERSUITE_DB_PASSWORD"
  | "MASTERSUITE_DB_NAME";

export const REQUIRED_MASTERSUITE_ENV: MasterSuiteEnvKey[] = [
  "MASTERSUITE_DB_HOST",
  "MASTERSUITE_DB_PORT",
  "MASTERSUITE_DB_USER",
  "MASTERSUITE_DB_PASSWORD",
  "MASTERSUITE_DB_NAME",
];

export function getMissingMasterSuiteEnv(env: Record<string, string | undefined> = process.env): MasterSuiteEnvKey[] {
  return REQUIRED_MASTERSUITE_ENV.filter((key) => !env[key]);
}

export async function checkMasterSuiteHealth(options: { checkConnection?: boolean } = {}) {
  const missingEnv = getMissingMasterSuiteEnv();
  if (missingEnv.length > 0) {
    return {
      ok: false,
      missingEnv,
      connectionChecked: false,
      error: `Missing MasterSuite env: ${missingEnv.join(", ")}`,
    };
  }

  if (!options.checkConnection) {
    return { ok: true, missingEnv: [], connectionChecked: false, error: null };
  }

  try {
    await checkMSConnection();
    return { ok: true, missingEnv: [], connectionChecked: true, error: null };
  } catch (err) {
    return {
      ok: false,
      missingEnv: [],
      connectionChecked: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
