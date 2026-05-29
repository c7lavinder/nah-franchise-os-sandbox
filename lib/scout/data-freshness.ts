type DataFreshnessRow = {
  job_name: string;
  finished_at: string | null;
};

type DataFreshnessQuery = {
  in(column: string, values: string[]): DataFreshnessQuery;
  eq(column: string, value: string): DataFreshnessQuery;
  order(column: string, options: { ascending: boolean }): DataFreshnessQuery;
  limit(count: number): Promise<{ data: DataFreshnessRow[] | null }>;
};

type DataFreshnessClient = {
  from(table: "cron_job_log"): {
    select(columns: string): DataFreshnessQuery;
  };
};

/** Check when key data syncs last ran and return a one-liner for the system prompt. */
export async function loadDataFreshness(supabase: DataFreshnessClient): Promise<string> {
  try {
    const jobs = ["sync-ms-prospects", "sync-ms-properties", "sync-ms-territories"];
    const { data } = await supabase
      .from("cron_job_log")
      .select("job_name, finished_at")
      .in("job_name", jobs)
      .eq("status", "success")
      .order("finished_at", { ascending: false })
      .limit(3);

    const rows = data as DataFreshnessRow[] | null;

    if (!rows || rows.length === 0) {
      return "DATA FRESHNESS: No successful data syncs recorded. Territory and property data may be incomplete.";
    }

    const lines: string[] = [];
    for (const job of jobs) {
      const row = rows.find((r) => r.job_name === job);
      if (row?.finished_at) {
        const hoursAgo = Math.round((Date.now() - new Date(row.finished_at).getTime()) / (1000 * 60 * 60));
        if (hoursAgo > 24) {
          lines.push(`${job}: last synced ${hoursAgo}h ago (STALE)`);
        }
      } else {
        lines.push(`${job}: no successful sync on record`);
      }
    }

    if (lines.length === 0) return "";
    return `DATA FRESHNESS WARNING — Some data may be stale. If a query returns zeros or empty results, mention that data was last synced over 24h ago rather than speculating about causes.\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}
