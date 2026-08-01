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

/**
 * Guard: when targeting prod, refuse an account that cannot actually write.
 *
 * This used to compare the configured user against `MASTERSUITE_DB_USER` and
 * refuse on a name match, on the premise that the reporting account held
 * SELECT only. That premise expired on 2026-08-01, when the PR #409 grant gave
 * `mastersuite_nah_franchise_os` INSERT/UPDATE/DELETE on `frandev_%` — the same
 * account named by `MASTERSUITE_DB_USER`, so the name check blocked the very
 * credential the grant was written to enable.
 *
 * Ask the database instead of guessing from a name: the intent was always
 * "don't start a 100k-row push with a credential that will die at the first
 * INSERT", and privileges are the honest test of that. Still fails loudly, just
 * on evidence.
 */
async function assertWriteCapable(pool: mysql.Pool, cfg: WriteDbConfig): Promise<void> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>("SHOW GRANTS FOR CURRENT_USER()");
  const grants = rows.map((r) => String(Object.values(r)[0] ?? ""));
  const canWrite = grants.some(
    (g) => /\b(INSERT|ALL PRIVILEGES)\b/i.test(g) && /frandev|\*\.\*|`mastersuite`\.\*/i.test(g)
  );
  if (!canWrite) {
    throw new Error(
      `The account "${cfg.user}" on ${cfg.host} holds no INSERT privilege on ` +
        `mastersuite.frandev_% — a live push would fail at the first row. ` +
        `Run database/2026-07-29_grant_frandev_sync_write.sql, or point ` +
        `MASTERSUITE_PROD_DB_USER at the account that has the grant.`
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
  if (target !== "prod") {
    assertNotProduction(cfg.host);
  }
  // The prod-side privilege check needs a live connection, so it runs in
  // assertWriteCapableOrThrow() once the pool exists — call it before pushing.
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

/**
 * Verify the configured prod account can actually INSERT into `frandev_%`.
 * No-op when targeting dev. Call once before a live push.
 */
export async function assertWriteCapableOrThrow(): Promise<void> {
  const target = getWriteTarget();
  if (target !== "prod") return;
  const cfg = resolveWriteConfig(target);
  if (!cfg) return; // credential absence is reported by the caller's own check
  await assertWriteCapable(getMasterSuiteWritePool(), cfg);
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
