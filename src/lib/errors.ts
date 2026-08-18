/** Deliberate, user-facing rule violations (quarter steps, day cap, …).
 *  Their messages are written for the user and pass through verbatim. */
export class ValidationError extends Error {}

/** One rate per (project, effectiveDate) — rejection carries the reason. */
export class RateDateConflictError extends Error {}

/** A message safe to show the user. Known app errors pass through; anything
 *  unexpected (plugin/SQL failures) becomes the friendly fallback, with the
 *  raw error logged to the console for debugging. */
export function userErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ValidationError || e instanceof RateDateConflictError) {
    return e.message;
  }
  console.error(e);
  return fallback;
}
