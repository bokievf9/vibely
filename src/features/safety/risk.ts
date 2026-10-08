// Heuristic scam signals in chat messages (EN, Malay, Manglish). Used only to show a warning
// under the other person's message, never to block it, so it errs on the side of flagging.
// Pure and dependency-free: unit-tested with `node --test` (tests/unit/risk.test.mjs).
export type RiskKind = 'phone' | 'link' | 'messenger' | 'money'

// Runs of digits with common separators; checked for 9–15 digits (MY mobiles have 10–11).
const PHONE_CANDIDATE = /\+?\d[\d\s\-.()]{6,}\d/g

const LINK =
  /\bhttps?:\/\/|\bwww\.|\b(?:t\.me|wa\.me|bit\.ly|tinyurl\.com|linktr\.ee)\b|\b[a-z0-9-]{2,}\.(?:com|net|org|io|me|ly|co|my|xyz|app|link|site|info|biz|cc|top|vip|shop|online|club|live|pro)\b/

const MESSENGER = new RegExp(
  [
    'whats\\s*app',
    'what\\s*sap+',
    'wh?at?sap+',
    'was+ap+',
    'whtsap+',
    'telegram',
    'tele\\s*(?:me|id)',
    '\\btg\\b',
    'we\\s*chat',
    'weixin',
    '\\bline\\s*(?:id|me|app)\\b',
    '\\b(?:add|pm|dm|msg|text)\\s+(?:me\\s+)?(?:on|in|kat|dekat)\\s+line\\b',
    '\\bsignal\\s+app\\b',
    'viber',
    'kakao',
    'snap\\s*chat',
    '\\bcall\\s+me\\s+(?:on|at)\\b',
    '(?:^|\\s)@[a-z0-9_.]{4,}',
  ].join('|'),
)

const MONEY = new RegExp(
  [
    // English
    'money',
    'cash',
    '\\bbank',
    'account\\s*(?:no|number)',
    '\\bacc\\s*no\\b',
    'transfer',
    'crypto',
    'bitcoin',
    '\\bbtc\\b',
    '\\beth\\b',
    'usdt',
    'binance',
    'forex',
    'invest',
    'trading',
    '\\btrade\\b',
    '\\bprofit',
    '\\broi\\b',
    '\\bloan',
    '\\blend\\b',
    'borrow',
    'deposit',
    'withdraw',
    'gift\\s*card',
    'western\\s*union',
    'paypal',
    'e-?wallet',
    'duitnow',
    '\\btng\\b',
    "touch\\s*['n&]*\\s*go",
    'grab\\s*pay',
    'boost\\s*(?:app|wallet)',
    // Malay / Manglish
    '\\bduit\\b',
    '\\bwang\\b',
    '\\bpinjam',
    'hutang',
    'pelaburan',
    'melabur',
    '\\buntung\\b',
    '\\bmodal\\b',
    '\\bakaun\\b',
    '\\bbayar(?:an)?\\b',
    '\\bkripto',
    '\\bsaham\\b',
    // Amounts: RM50, RM 1,000, $200, USD 100
    '\\brm\\s?\\d',
    '\\$\\s?\\d',
    '\\b(?:usd|myr)\\s?\\d',
  ].join('|'),
)

function hasPhone(text: string): boolean {
  for (const match of text.matchAll(PHONE_CANDIDATE)) {
    const digits = match[0].replace(/\D/g, '').length
    if (digits >= 9 && digits <= 15) return true
  }
  return false
}

export function detectRisk(text: string): RiskKind[] {
  const t = text.normalize('NFKC').toLowerCase()
  const kinds: RiskKind[] = []
  if (hasPhone(t)) kinds.push('phone')
  if (LINK.test(t)) kinds.push('link')
  if (MESSENGER.test(t)) kinds.push('messenger')
  if (MONEY.test(t)) kinds.push('money')
  return kinds
}

export const isRisky = (text: string) => detectRisk(text).length > 0
