import mysql from "mysql2/promise";

/**
 * Write connection to the MasterSuite DEVELOPMENT MariaDB.
 *
 * This is intentionally separate from `client.ts` (the read-only PRODUCTION
 * pool). Every existing MasterSuite sync is inbound (MasterSuite -> Supabase)
 * and read-only. The FranDev push is the only OUTBOUND path: it writes our
 * Supabase data into the `frandev_*` tables on the MasterSuite dev box so the
 * pages being rebuilt there have real data each working day.
 *
 * Credential resolution (first match wins):
 *   1. `MASTERSUITE_DEV_DB_*`  — explicit override (set these on Vercel/CI).
 *   2. `NAH_DB_*`              — the MasterSuite app's own dev DB env vars,
 *                                already present in the operator's shell
 *                                profile, so the local script "just works".
 *
 * Hard safety: we refuse to connect to a host that looks like production, so a
 * mis-set `NAH_DB_SERVER` can never turn this outbound sync into a prod write.
 */

interface DevDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

let writePool: mysql.Pool | null = null;

function resolveDevConfig(): DevDbConfig | null {
  const host = process.env.MASTERSUITE_DEV_DB_HOST || process.env.NAH_DB_SERVER;
  const user = process.env.MASTERSUITE_DEV_DB_USER || process.env.NAH_DB_USER;
  const password = process.env.MASTERSUITE_DEV_DB_PASSWORD || process.env.NAH_DB_PASSWORD;
  if (!host || !user || !password) return null;
  return {
    host,
    port: parseInt(process.env.MASTERSUITE_DEV_DB_PORT || process.env.NAH_DB_PORT || "3306", 10),
    user,
    password,
    database: process.env.MASTERSUITE_DEV_DB_NAME || process.env.NAH_DB_DATABASE || "mastersuite",
  };
}

/** Guard: never let the outbound push write to the production database. */
function assertNotProduction(host: string): void {
  const prodHost = process.env.MASTERSUITE_DB_HOST; // read-only prod endpoint
  if (/prod/i.test(host) || (prodHost && host === prodHost)) {
    throw new Error(
      `Refusing to run the FranDev push against "${host}" — it looks like PRODUCTION. ` +
        `This sync writes to the dev database only.`
    );
  }
}

/** True when dev write credentials are resolvable. Lets callers no-op cleanly. */
export function isWriteConfigured(): boolean {
  return resolveDevConfig() !== null;
}

export function getMasterSuiteWritePool(): mysql.Pool {
  if (writePool) return writePool;

  const cfg = resolveDevConfig();
  if (!cfg) {
    throw new Error("MasterSuite dev write credentials not set. Provide MASTERSUITE_DEV_DB_* or NAH_DB_* env vars.");
  }
  assertNotProduction(cfg.host);

  writePool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectionLimit: 3,
    connectTimeout: 10000,
    waitForConnections: true,
    enableKeepAlive: true,
    idleTimeout: 30000,
    maxIdle: 1,
  });

  return writePool;
}

/** Fast connectivity check — fails within ~5s if the dev DB is unreachable. */
export async function checkMSWriteConnection(): Promise<void> {
  const p = getMasterSuiteWritePool();
  const conn = await p.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

export async function endMasterSuiteWritePool(): Promise<void> {
  if (writePool) {
    await writePool.end();
    writePool = null;
  }
}
