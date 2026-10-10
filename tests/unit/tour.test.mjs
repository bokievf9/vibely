// npm run test:unit (Node strips the TypeScript types natively).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  appPath,
  isAutoStartPath,
  isTourAllowedPath,
  mergeSeen,
  nextTip,
  OPTIONAL_TIMEOUT_MS,
  parseLocal,
  ROUTE_ORDER,
  routesInOrder,
  shouldAutoStart,
  stepAfter,
  TARGET_TIMEOUT_MS,
  targetTimeout,
  TIP_KEYS,
  TOUR_STEPS,
  visibleSteps,
} from '../../src/features/tour/steps.ts'
import { cardWidth, GUTTER, place, unionRect } from '../../src/features/tour/placement.ts'
import { tourEn } from '../../src/i18n/dictionaries/tour/en.ts'
import { tourMs } from '../../src/i18n/dictionaries/tour/ms.ts'
import { tourRu } from '../../src/i18n/dictionaries/tour/ru.ts'

const ids = (steps) => steps.map((s) => s.id)

test('steps: one pass through the tabs in order, Discover first, Plans last', () => {
  assert.equal(routesInOrder(TOUR_STEPS), true)
  assert.equal(TOUR_STEPS[0].route, '/swipe')
  assert.equal(TOUR_STEPS.at(-1).id, 'plans')
  const routes = [...new Set(TOUR_STEPS.map((s) => s.route))]
  assert.deepEqual(routes, ROUTE_ORDER)
  assert.equal(routesInOrder([TOUR_STEPS[8], TOUR_STEPS[0]]), false)
})

test('steps: unique ids, every step has copy in all three languages', () => {
  assert.equal(new Set(ids(TOUR_STEPS)).size, TOUR_STEPS.length)
  for (const s of TOUR_STEPS) {
    for (const d of [tourEn, tourMs, tourRu]) {
      assert.ok(d.steps[s.id]?.title && d.steps[s.id]?.text, `${s.id} copy`)
    }
  }
})

test('steps: about ten core steps, the optional ones are extras', () => {
  const core = TOUR_STEPS.filter((s) => !s.optional)
  assert.ok(core.length >= 8 && core.length <= 10, `core: ${core.length}`)
  assert.deepEqual(
    ids(TOUR_STEPS.filter((s) => s.optional)),
    ['statuses', 'event', 'crossed', 'mode'],
  )
})

test('stepAfter: walks forward and back, skipping missing steps', () => {
  const none = new Set()
  assert.equal(stepAfter(TOUR_STEPS, 0, 1, none), 1)
  assert.equal(stepAfter(TOUR_STEPS, 0, -1, none), -1)
  assert.equal(stepAfter(TOUR_STEPS, TOUR_STEPS.length - 1, 1, none), TOUR_STEPS.length)
  // Duo off, no statuses, no event, no crossings: filters jumps straight to likes and search.
  const missing = new Set(['statuses', 'event', 'crossed', 'mode'])
  const filters = ids(TOUR_STEPS).indexOf('filters')
  const people = ids(TOUR_STEPS).indexOf('people')
  assert.equal(stepAfter(TOUR_STEPS, filters, 1, missing), people)
  assert.equal(stepAfter(TOUR_STEPS, people, -1, missing), filters)
  assert.equal(visibleSteps(TOUR_STEPS, missing).length, TOUR_STEPS.length - 4)
  // Everything after the start missing: the tour ends.
  const all = new Set(ids(TOUR_STEPS).slice(1))
  assert.equal(stepAfter(TOUR_STEPS, 0, 1, all), TOUR_STEPS.length)
})

test('targetTimeout: core steps wait, optional ones barely', () => {
  const deck = TOUR_STEPS.find((s) => s.id === 'deck')
  const statuses = TOUR_STEPS.find((s) => s.id === 'statuses')
  assert.equal(targetTimeout(deck, 0), TARGET_TIMEOUT_MS)
  assert.equal(targetTimeout(statuses, 0), OPTIONAL_TIMEOUT_MS)
  assert.equal(targetTimeout(statuses, 1000), OPTIONAL_TIMEOUT_MS - 1000)
  assert.equal(targetTimeout(statuses, 9000), 0)
})

test('paths: locale prefix, rooms and auth screens', () => {
  assert.equal(appPath('/ms/swipe'), '/swipe')
  assert.equal(appPath('/ru/settings/'), '/settings')
  assert.equal(appPath('/en'), '/')
  assert.equal(appPath('/admin'), null)
  assert.equal(isAutoStartPath('/en/swipe'), true)
  assert.equal(isAutoStartPath('/en/feed'), false)
  for (const p of ['/en/swipe', '/ms/feed', '/ru/settings', '/en/plans', '/en/profile']) {
    assert.equal(isTourAllowedPath(p), true, p)
  }
  for (const p of [
    '/admin',
    '/admin/users',
    '/en/login',
    '/en/onboarding',
    '/ms/selfie-verification',
    '/en/terms',
    '/en/chats/123',
    '/en/chats/group/9',
    '/ru/blind-date/abc',
  ]) {
    assert.equal(isTourAllowedPath(p), false, p)
  }
})

test('auto-start: only new accounts, once, on Discover', () => {
  const fresh = { auto: true, completedAt: null, skippedAt: null }
  const clean = { done: null, tips: [] }
  assert.equal(shouldAutoStart(fresh, clean, '/en/swipe'), true)
  assert.equal(shouldAutoStart(fresh, clean, '/en/chats'), false)
  // Old account (the server says no), or already ended on the server or on this device.
  assert.equal(shouldAutoStart({ ...fresh, auto: false }, clean, '/en/swipe'), false)
  assert.equal(shouldAutoStart({ ...fresh, skippedAt: '2026-10-10' }, clean, '/en/swipe'), false)
  assert.equal(shouldAutoStart({ ...fresh, completedAt: '2026-10-10' }, clean, '/en/swipe'), false)
  assert.equal(shouldAutoStart(fresh, { done: 'skip', tips: [] }, '/en/swipe'), false)
})

test('tips: one at a time, in order, never twice', () => {
  const seen = mergeSeen(['duo'], ['statuses'])
  assert.deepEqual([...seen].sort(), ['duo', 'statuses'])
  const onScreen = new Set(['statuses', 'event', 'duo'])
  assert.equal(nextTip((k) => onScreen.has(k), seen), 'event')
  assert.equal(nextTip((k) => onScreen.has(k), new Set([...seen, 'event'])), null)
  assert.equal(nextTip(() => false, new Set()), null)
  for (const key of TIP_KEYS) {
    for (const d of [tourEn, tourMs, tourRu]) assert.ok(d.tip[key]?.title && d.tip[key]?.text, key)
  }
})

test('local record: tolerant parsing', () => {
  assert.deepEqual(parseLocal(null), { done: null, tips: [] })
  assert.deepEqual(parseLocal('not json'), { done: null, tips: [] })
  assert.deepEqual(parseLocal('{"done":"skip","tips":["duo",3]}'), { done: 'skip', tips: ['duo'] })
  assert.deepEqual(parseLocal('{"done":"weird"}'), { done: null, tips: [] })
})

test('placement: below when it fits, above near the bottom, never off screen', () => {
  const vp = { width: 360, height: 740 }
  const insets = { top: 8, bottom: 8 }
  // A header button.
  const below = place({ x: 300, y: 10, width: 44, height: 44 }, vp, 170, insets)
  assert.equal(below.side, 'below')
  assert.ok(below.card.y >= below.spot.y + below.spot.height)
  // A tab bar item.
  const above = place({ x: 216, y: 676, width: 72, height: 64 }, vp, 170, insets)
  assert.equal(above.side, 'above')
  assert.ok(above.card.y + 170 <= above.spot.y)
  // A tall card: its top part lights up, the card goes under it.
  const tall = place({ x: 12, y: 60, width: 336, height: 640 }, vp, 170, insets)
  assert.equal(tall.side, 'below')
  assert.ok(tall.spot.height < 640 && tall.card.y + 170 <= vp.height - insets.bottom)
  for (const width of [320, 360, 390, 430]) {
    for (const x of [0, 100, width - 44]) {
      const p = place({ x, y: 300, width: 44, height: 44 }, { width, height: 740 }, 170, insets)
      assert.ok(p.card.x >= GUTTER && p.card.x + p.card.width <= width - GUTTER, `${width}/${x}`)
      assert.ok(p.spot.x >= 0 && p.spot.x + p.spot.width <= width)
      if (p.arrowX !== null) assert.ok(p.arrowX >= 24 && p.arrowX <= p.card.width - 24)
    }
  }
  assert.equal(cardWidth(360), 328)
  assert.equal(cardWidth(1024), 360)
})

test('placement: no room anywhere floats the card at the bottom', () => {
  const p = place({ x: 0, y: 100, width: 360, height: 60 }, { width: 360, height: 300 }, 260, {
    top: 8,
    bottom: 8,
  })
  assert.equal(p.side, 'over')
  assert.ok(p.card.y >= 8 && p.arrowX === null)
})

test('unionRect: wraps every target, ignores hidden ones', () => {
  assert.deepEqual(
    unionRect([
      { x: 250, y: 10, width: 44, height: 44 },
      { x: 300, y: 10, width: 44, height: 44 },
      { x: 0, y: 0, width: 0, height: 0 },
    ]),
    { x: 250, y: 10, width: 94, height: 44 },
  )
  assert.equal(unionRect([]), null)
})

test('copy: same keys in every language, no em or en dashes', () => {
  const shape = (o) =>
    Object.entries(o)
      .map(([k, v]) => (typeof v === 'object' ? `${k}{${shape(v)}}` : k))
      .sort()
      .join(',')
  assert.equal(shape(tourMs), shape(tourEn))
  assert.equal(shape(tourRu), shape(tourEn))
  for (const d of [tourEn, tourMs, tourRu]) {
    assert.doesNotMatch(JSON.stringify(d), /[–—]/)
  }
})
