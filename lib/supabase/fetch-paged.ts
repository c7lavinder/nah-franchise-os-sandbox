/**
 * Fetch ALL rows of a Supabase query by paging past the silent 1000-row cap.
 *
 * Supabase's PostgREST layer truncates any select at 1000 rows unless
 * .range()/.limit() paging is applied. Any query whose table can exceed
 * 1000 rows AND whose result feeds aggregation (counts, averages, funnels)
 * must go through this helper — otherwise the numbers are silently wrong.
 *
 * Usage:
 *   const rows = await fetchPaged<Row>((from, to) =>
 *     db.from("journey_pipeline_state").select("...").eq("is_active", true).range(from, to)
 *   );
 */
export async function fetchPaged<T>(
  queryFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error?: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  while (true) {
    const { data } = await queryFactory(offset, offset + 999);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return rows;
}
