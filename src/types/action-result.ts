// Uniform return type for every Server Action. User-facing actions use translation keys (ErrorKey)
// as `error`, the Russian-only admin panel uses plain messages. `upgrade` is set when the database
// refused because of the user's plan (SQLSTATE VP402, src/features/plans/errors.ts): the client
// shows <UpgradeCard> for that feature instead of a plain error.
export type ActionResult<T = void, E extends string = string> =
  | { ok: true; data: T }
  | {
      ok: false
      error: E
      fieldErrors?: Record<string, string[]>
      upgrade?: { feature: string; reason: 'feature' | 'limit' | 'partner' }
    }
