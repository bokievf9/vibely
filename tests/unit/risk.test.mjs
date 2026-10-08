// npm run test:unit (Node strips the TypeScript types natively).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectRisk, isRisky } from '../../src/features/safety/risk.ts'

const has = (text, kind) => assert.ok(detectRisk(text).includes(kind), `${kind}: ${text}`)

test('phone numbers', () => {
  has('call me 012-345 6789', 'phone')
  has('+60 12 345 6789', 'phone')
  has('my no 0123456789', 'phone')
  has('(011) 2345-6789', 'phone')
  assert.ok(!detectRisk('see you at 7:30 on 12/10').includes('phone'))
  assert.ok(!detectRisk('I was born in 1995').includes('phone'))
})

test('links', () => {
  has('check https://example.com', 'link')
  has('go to www.mysite.net', 'link')
  has('join t.me/cheapcoins', 'link')
  has('wa.me/60123456789', 'link')
  has('visit lucky-profit.xyz now', 'link')
})

test('messenger handles', () => {
  for (const text of [
    'add me on WhatsApp',
    'whatsapp me',
    'wasap je la',
    'watsapp me la',
    'my telegram is cool_guy',
    'tele me',
    'add my wechat',
    'line id: sweetie88',
    'pm me on line',
    'follow @sweetie_88',
  ])
    has(text, 'messenger')
})

test('money, crypto, bank and investment (EN + Malay + Manglish)', () => {
  for (const text of [
    'can you transfer me some money',
    'I need cash urgently',
    'send to my bank account',
    'acc no 1234',
    'I trade bitcoin and USDT',
    'good investment opportunity, 30% profit',
    'forex signals',
    'boleh pinjam duit sikit?',
    'tolong bank in RM500',
    'pelaburan ni untung besar',
    'topup tng for me',
    'send via touch n go',
    'just $200 for the ticket',
  ])
    has(text, 'money')
})

test('ordinary chat is not flagged', () => {
  for (const text of [
    'Hi! How was your day?',
    'Jom makan nasi lemak esok?',
    'I love hiking and coffee',
    'Saya suka tengok wayang',
    'online now, what about you',
    'we can meet at the mall lah',
    'haha same, wa pun tak tau',
    'line up at the cinema was long',
    'Bila free?',
  ])
    assert.deepEqual(detectRisk(text), [], text)
})

test('isRisky', () => {
  assert.equal(isRisky('hello'), false)
  assert.equal(isRisky('whatsapp me 0123456789'), true)
  assert.deepEqual(detectRisk('whatsapp me 0123456789'), ['phone', 'messenger'])
})
