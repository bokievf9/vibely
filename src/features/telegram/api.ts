// Minimal Telegram Bot API client with retries. Pure (fetch and sleep are injectable), so the
// unit tests run it against a mock fetch; never logs the token or the request URL.

export type TgResult<T> =
  { ok: true; result: T } | { ok: false; status: number; description: string }

export type TgFile = { name: string; data: Blob }

export type TelegramApi = {
  call<T = unknown>(method: string, params: Record<string, unknown>): Promise<TgResult<T>>
  // multipart/form-data upload: `files` are attached under their field names.
  upload<T = unknown>(
    method: string,
    params: Record<string, unknown>,
    files: Record<string, TgFile>,
  ): Promise<TgResult<T>>
}

type Options = {
  token: string
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  maxAttempts?: number
  timeoutMs?: number
  log?: (message: string) => void
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Waits before the next attempt: Telegram's retry_after on 429 (capped at 30 s), otherwise
// exponential backoff (0.5 s, 1 s, 2 s ...).
export function retryDelayMs(attempt: number, retryAfterS?: number): number {
  if (retryAfterS && retryAfterS > 0) return Math.min(retryAfterS, 30) * 1000
  return Math.min(500 * 2 ** (attempt - 1), 8000)
}

const shouldRetry = (status: number) => status === 429 || status >= 500

export function createTelegramApi(opts: Options): TelegramApi {
  const doFetch = opts.fetch ?? fetch
  const sleep = opts.sleep ?? defaultSleep
  const maxAttempts = opts.maxAttempts ?? 3
  const timeoutMs = opts.timeoutMs ?? 15_000
  const log = opts.log ?? ((m: string) => console.error(m))
  const base = `https://api.telegram.org/bot${opts.token}/`

  async function request<T>(method: string, body: () => BodyInit, json: boolean) {
    let last: TgResult<T> = { ok: false, status: 0, description: 'not sent' }
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let retryAfter: number | undefined
      try {
        const res = await doFetch(base + method, {
          method: 'POST',
          headers: json ? { 'content-type': 'application/json' } : undefined,
          body: body(),
          signal: AbortSignal.timeout(timeoutMs),
        })
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean
          result?: T
          description?: string
          parameters?: { retry_after?: number }
        } | null
        if (res.ok && data?.ok) return { ok: true, result: data.result as T } as const
        retryAfter = data?.parameters?.retry_after
        last = {
          ok: false,
          status: res.status,
          description: String(data?.description ?? `HTTP ${res.status}`).slice(0, 200),
        }
        if (!shouldRetry(res.status)) break
      } catch (e) {
        const name = e instanceof Error ? e.name : 'Error'
        last = { ok: false, status: 0, description: name === 'TimeoutError' ? 'timeout' : name }
      }
      if (attempt < maxAttempts) await sleep(retryDelayMs(attempt, retryAfter))
    }
    log(`[telegram] ${method} failed: ${last.ok ? '' : `${last.status} ${last.description}`}`)
    return last
  }

  return {
    call(method, params) {
      return request(method, () => JSON.stringify(params), true)
    },
    upload(method, params, files) {
      return request(
        method,
        () => {
          const form = new FormData()
          for (const [k, v] of Object.entries(params)) {
            if (v === undefined || v === null) continue
            form.append(k, typeof v === 'string' ? v : JSON.stringify(v))
          }
          for (const [field, file] of Object.entries(files))
            form.append(field, file.data, file.name)
          return form
        },
        false,
      )
    },
  }
}
