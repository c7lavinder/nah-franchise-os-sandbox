export const SYNC_WATERMARK_STREAMS = ["sync-ms-prospects"] as const;

export type SyncWatermarkStream = (typeof SYNC_WATERMARK_STREAMS)[number];

export interface SyncWatermark {
  streamName: SyncWatermarkStream;
  lastSuccessCursor: string | null;
  lastSuccessAt: string | null;
  lastAttemptCursor: string | null;
  lastAttemptAt: string | null;
  metadata: Record<string, unknown>;
}

type SyncWatermarkRow = {
  stream_name: SyncWatermarkStream;
  last_success_cursor: string | null;
  last_success_at: string | null;
  last_attempt_cursor: string | null;
  last_attempt_at: string | null;
  metadata: Record<string, unknown> | null;
};

type SyncWatermarkClient = {
  from(table: "sync_watermarks"): any;
};

function toWatermark(row: SyncWatermarkRow | null): SyncWatermark | null {
  if (!row) return null;
  return {
    streamName: row.stream_name,
    lastSuccessCursor: row.last_success_cursor,
    lastSuccessAt: row.last_success_at,
    lastAttemptCursor: row.last_attempt_cursor,
    lastAttemptAt: row.last_attempt_at,
    metadata: row.metadata ?? {},
  };
}

export async function getSyncWatermark(
  db: SyncWatermarkClient,
  streamName: SyncWatermarkStream
): Promise<SyncWatermark | null> {
  const { data, error } = await db
    .from("sync_watermarks")
    .select("stream_name, last_success_cursor, last_success_at, last_attempt_cursor, last_attempt_at, metadata")
    .eq("stream_name", streamName)
    .maybeSingle();

  if (error) throw new Error(`Failed to read ${streamName} watermark: ${error.message}`);
  return toWatermark(data as SyncWatermarkRow | null);
}

export async function recordSyncWatermarkAttempt(
  db: SyncWatermarkClient,
  streamName: SyncWatermarkStream,
  cursor: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db.from("sync_watermarks").upsert(
    {
      stream_name: streamName,
      last_attempt_cursor: cursor,
      last_attempt_at: now,
      metadata,
      updated_at: now,
    },
    { onConflict: "stream_name" }
  );

  if (error) throw new Error(`Failed to record ${streamName} watermark attempt: ${error.message}`);
}

export async function recordSyncWatermarkSuccess(
  db: SyncWatermarkClient,
  streamName: SyncWatermarkStream,
  cursor: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db.from("sync_watermarks").upsert(
    {
      stream_name: streamName,
      last_success_cursor: cursor,
      last_success_at: now,
      last_attempt_cursor: cursor,
      last_attempt_at: now,
      metadata,
      updated_at: now,
    },
    { onConflict: "stream_name" }
  );

  if (error) throw new Error(`Failed to record ${streamName} watermark success: ${error.message}`);
}
