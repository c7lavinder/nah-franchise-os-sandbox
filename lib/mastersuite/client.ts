import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getMasterSuitePool(): mysql.Pool {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.MASTERSUITE_DB_HOST!,
    port: parseInt(process.env.MASTERSUITE_DB_PORT || "60263"),
    user: process.env.MASTERSUITE_DB_USER!,
    password: process.env.MASTERSUITE_DB_PASSWORD!,
    database: process.env.MASTERSUITE_DB_NAME || "mastersuite",
    connectionLimit: 3,
    connectTimeout: 10000,
    waitForConnections: true,
    enableKeepAlive: true,
    // Prevent stale connections from hanging on serverless (Vercel)
    idleTimeout: 30000,
    maxIdle: 1,
  });

  return pool;
}

export async function queryMS<T = Record<string, unknown>>(
  sql: string,
  params?: (string | number | boolean | null)[]
): Promise<T[]> {
  const p = getMasterSuitePool();
  const [rows] = params ? await p.execute(sql, params) : await p.execute(sql);
  return rows as T[];
}
