// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN_ROLES, hasRole, MODERATOR_MAX_BAN_DAYS } from '../../src/features/admin/roles.ts'
import { maskPhone } from '../../src/features/admin/mask.ts'

test('roles: same order as the SQL enum admin_role', () => {
  assert.deepEqual([...ADMIN_ROLES], ['viewer', 'moderator', 'admin', 'owner'])
})

test('roles: a role includes the lower ones', () => {
  assert.equal(hasRole('owner', 'viewer'), true)
  assert.equal(hasRole('admin', 'admin'), true)
  assert.equal(hasRole('moderator', 'admin'), false)
  assert.equal(hasRole('viewer', 'moderator'), false)
})

test('roles: moderators ban for at most a week', () => {
  assert.equal(MODERATOR_MAX_BAN_DAYS, 7)
})

test('mask: phone shows country code and last 4 digits only', () => {
  assert.equal(maskPhone('60123456789'), '+60 •••• 6789')
  assert.equal(maskPhone(null), 'нет телефона')
})
