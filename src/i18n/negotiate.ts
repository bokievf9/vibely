import { DEFAULT_LOCALE, LOCALE_COOKIE, hasLocale, type Locale } from './config'

type RequestLike = {
  cookies: { get(name: string): { value: string } | undefined }
  headers: { get(name: string): string | null }
}

// Cookie (last used language) → Accept-Language → default.
export function preferredLocale(request: RequestLike): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value
  if (hasLocale(saved)) return saved

  const accepted = (request.headers.get('accept-language') ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', q] = part.trim().split(';q=')
      return { lang: tag.toLowerCase().split('-')[0], q: q ? Number(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)
  return (accepted.find((a) => hasLocale(a.lang))?.lang as Locale | undefined) ?? DEFAULT_LOCALE
}

// "/ms/chats/1" → { locale: "ms", rest: "/chats/1" }
export function splitLocale(pathname: string): { locale: Locale | null; rest: string } {
  const [, first, ...tail] = pathname.split('/')
  return hasLocale(first)
    ? { locale: first, rest: `/${tail.join('/')}` }
    : { locale: null, rest: pathname }
}
