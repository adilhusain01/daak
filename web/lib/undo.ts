/**
 * Runs the step after a write; if that step fails, undoes the write and rethrows the step's own error.
 * Used when a booking's record is saved before its fee is locked, so a failed lock leaves no ghost booking.
 */
export async function orUndo<K, T>(made: K, next: () => Promise<T>, undo: (made: K) => Promise<unknown>): Promise<T> {
  try {
    return await next();
  } catch (e) {
    await undo(made).catch((u) => console.error("undo failed", (u as Error).message));
    throw e;
  }
}
