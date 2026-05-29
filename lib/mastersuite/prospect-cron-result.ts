export interface SyncProspectsCronResult {
  created: number;
  wired: number;
  skipped: number;
  errors: string[];
  sourceCursor?: string | null;
  watermarkCursor?: string | null;
}

export function formatSyncProspectsCronResult(result: SyncProspectsCronResult): {
  status: "success" | "failed";
  result: Record<string, unknown>;
  error: string | null;
} {
  const partialFailure = result.errors.length > 0;
  const resultData: Record<string, unknown> = {
    created: result.created,
    wired: result.wired,
    skipped: result.skipped,
    errors: result.errors,
    partialFailure,
  };
  if (result.sourceCursor) resultData.sourceCursor = result.sourceCursor;
  if (result.watermarkCursor) resultData.watermarkCursor = result.watermarkCursor;

  return {
    status: partialFailure ? "failed" : "success",
    result: resultData,
    error: partialFailure ? result.errors[0] : null,
  };
}
