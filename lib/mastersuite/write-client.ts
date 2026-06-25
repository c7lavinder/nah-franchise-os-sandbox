import mysql from "mysql2/promise";
import { optionalEnv, requireEnv } from "@/lib/env";

/**
 * Write connection to the MasterSuite DEVELOPMENT MariaDB.
 *
 * This is intentionally separate from `client.ts` (the read-only PRODUCTION
 * pool). Every existing MasterSuite sync is inbound (MasterSuite -> Supabase)
 * and read-only. The FranDev push is the only OUTBOUND path: it writes our
 * Supabase data into the `frandev_*` tables on the MasterSuite dev box so the
 * pages being rebuilt there have real data each working day.
 *
 * Credentials are distinct env vars (`MASTERSUITE_DEV_DB_*`) and must point at
 * the DEV database with a user that has INSERT/UPDATE on `frandev_*` tables.
 * The production credentials (`MASTERSUITE_DB_*`) are SELECT-only by design and
 * are never used to write.
 */

let writePool: mysql.Pool | null = null;

/** True when all dev write credentials are present. Lets callers no-op cleanly. */
export function isWriteConfigured(): boolean {
  return Boolean(
    process.env.MASTERSUITE_DEV_DB_HOST &&
    process.env.MASTERSUITE_DEV_DB_USER &&
    process.env.MASTERSUITE_DEV_DB_PASSWORD
  );
}

export function getMasterSuiteWritePool(): mysql.Pool {
  if (writePool) return writePool;

  writePool = mysql.createPool({
    host: requireEnv("MASTERSUITE_DEV_DB_HOST"),
    port: parseInt(optionalEnv("MASTERSUITE_DEV_DB_PORT", "3306"), 10),
    user: requireEnv("MASTERSUITE_DEV_DB_USER"),
    password: requireEnv("MASTERSUITE_DEV_DB_PASSWORD"),
    database: optionalEnv("MASTERSUITE_DEV_DB_NAME", "mastersuite"),
    connectionLimit: 3,
    connectTimeout: 10000,
    waitForConnections: true,
    enableKeepAlive: true,
    idleTimeout: 30000,
    maxIdle: 1,
    // Allow multi-row bulk inserts via `query` with nested arrays.
    namedPlaceholders: false,
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
