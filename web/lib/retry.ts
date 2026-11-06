/**
 * Whether a failed query should try again. Query functions throw the HTTP status as the message ("404").
 * A 4xx will not change on a retry (an unknown parcel code, a signed-out operator), so the page shows it at once;
 * server errors and dropped connections get at most two more tries.
 */
export function shouldRetry(failures: number, error: unknown): boolean {
  if (/^4\d\d$/.test((error as Error)?.message ?? "")) return false;
  return failures < 2;
}
