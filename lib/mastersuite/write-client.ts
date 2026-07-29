import mysql from "mysql2/promise";

/**
 * Write connection to the MasterSuite MariaDB (dev OR production).
 *
 * This is intentionally separate from `client.ts` (the read-only PRODUCTION
 * pool). Every existing MasterSuite sync is inbound (MasterSuite -> Supabase)
 * and read-only. The FranDev push is the only OUTBOUND path: it writes our
 * Supabase data into the `frandev_*` tables so the MasterSuite pages have real
 * data.
 *
 * TARGET SELECTION — `MASTERSUITE_WRITE_TARGET` = "dev" (default) | "prod".
 *
 * dev  — credentials resolve `MASTERSUITE_DEV_DB_*`, else `NAH_DB_*` (the
 *        MasterSuite app's own dev vars, already in the operator's shell
 *        profile, so the local script "just works"). A host that looks like
 *        production is REFUSED, so a mis-set `NAH_DB_SERVER` can never turn
 *        this into an accidental prod write.
 *
 * prod — credentials resolve `MASTERSUITE_PROD_DB_*` and NOTHING ELSE. There is
 *        deliberately no fallback chain: a missing/typo'd var must fail loudly
 *        rather than silently degrade to the dev box (which would send 97k rows
 *        to the wrong database) or to the read-only `MASTERSUITE_DB_*` user
 *        (which would fail confusingly at the first INSERT).
 *
 * Writing to production is authorized for `frandev_*` ONLY (Corey, 2026-07-29).
 * That boundary is enforced by the GRANT on the database user, not by this
 * file — the engine only ever emits `frandev_*` statements, but the privilege
 * is the real guarantee.
 */

export type WriteTarget = "dev" | "prod";

interface WriteDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

let writePool: mysql.Pool | null = null;
let writePoolTarget: WriteTarget | null = null;

/** Which database the outbound push is pointed at. Defaults to dev. */
export function getWriteTarget(): WriteTarget {
  return process.env.MASTERSUITE_WRITE_TARGET?.toLowerCase() === "prod" ? "prod" : "dev";
}

function resolveWriteConfig(target: WriteTarget): WriteDbConfig | null {
  if (target === "prod") {
    // No fallback chain by design — see the header comment.
    const host = process.env.MASTERSUITE_PROD_DB_HOST;
    const user = process.env.MASTERSUITE_PROD_DB_USER;
    const password = process.env.MASTERSUITE_PROD_DB_PASSWORD;
    if (!host || !user || !password) return null;
    return {
      host,
      port: parseInt(process.env.MASTERSUITE_PROD_DB_PORT || "3306", 10),
      user,
      password,
      database: process.env.MASTERSUITE_PROD_DB_NAME || "mastersuite",
    };
  }

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

/** Guard: when targeting dev, refuse a host that looks like production. */
function assertNotProduction(host: string): void {
  const prodHost = process.env.MASTERSUITE_DB_HOST; // read-only prod endpoint
  if (/prod/i.test(host) || (prodHost && host === prodHost)) {
    throw new Error(
      `Refusing to run the FranDev push against "${host}" — it looks like PRODUCTION, ` +
        `but MASTERSUITE_WRITE_TARGET is "dev". Set MASTERSUITE_WRITE_TARGET=prod ` +
        `plus MASTERSUITE_PROD_DB_* to write to production deliberately.`
    );
  }
}

/** Guard: when targeting prod, refuse the read-only user — it cannot INSERT. */
function assertNotReadOnlyUser(cfg: WriteDbConfig): void {
  if (process.env.MASTERSUITE_DB_USER && cfg.user === process.env.MASTERSUITE_DB_USER) {
    throw new Error(
      `MASTERSUITE_PROD_DB_USER is set to "${cfg.user}", which is the read-only ` +
        `reporting user (GRANT SELECT only). Use the account holding INSERT/UPDATE/DELETE ` +
        `on mastersuite.frandev_%.`
    );
  }
}

/** True when write credentials for the current target are resolvable. */
export function isWriteConfigured(): boolean {
  return resolveWriteConfig(getWriteTarget()) !== null;
}

export function getMasterSuiteWritePool(): mysql.Pool {
  const target = getWriteTarget();
  if (writePool && writePoolTarget === target) return writePool;

  const cfg = resolveWriteConfig(target);
  if (!cfg) {
    throw new Error(
      target === "prod"
        ? "MasterSuite PROD write credentials not set. Provide MASTERSUITE_PROD_DB_HOST/_PORT/_USER/_PASSWORD/_NAME."
        : "MasterSuite dev write credentials not set. Provide MASTERSUITE_DEV_DB_* or NAH_DB_* env vars."
    );
  }
  if (target === "prod") {
    assertNotReadOnlyUser(cfg);
  } else {
    assertNotProduction(cfg.host);
  }
  writePoolTarget = target;

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

/** Fast connectivity check — fails within ~5s if the target DB is unreachable. */
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
    writePoolTarget = null;
  }
}
