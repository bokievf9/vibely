// Uniform return type for every Server Action. User-facing actions use translation keys (ErrorKey)
// as `error`, the Russian-only admin panel uses plain messages.
export type ActionResult<T = void, E extends string = string> =
  { ok: true; data: T } | { ok: false; error: E; fieldErrors?: Record<string, string[]> }
