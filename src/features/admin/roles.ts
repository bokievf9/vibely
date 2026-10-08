// Moderator roles (20261009000150). No server-only: the panel's client components use the labels
// and hide what the current role can't do. The database enforces the same rules in every RPC.
import type { Enums } from '@/types/database.types'

// Lowest first: a role includes everything of the roles before it (same order as the SQL enum).
export const ADMIN_ROLES = [
  'viewer',
  'moderator',
  'admin',
  'owner',
] as const satisfies readonly Enums<'admin_role'>[]

export type AdminRole = (typeof ADMIN_ROLES)[number]

export const hasRole = (role: AdminRole, min: AdminRole) =>
  ADMIN_ROLES.indexOf(role) >= ADMIN_ROLES.indexOf(min)

export const ROLE_LABELS: Record<AdminRole, string> = {
  viewer: 'Наблюдатель',
  moderator: 'Модератор',
  admin: 'Администратор',
  owner: 'Владелец',
}

export const ROLE_HINTS: Record<AdminRole, string> = {
  viewer: 'Только просмотр',
  moderator: 'Селфи, контент, жалобы, предупреждения, муты, баны до 7 дней',
  admin:
    'Плюс бессрочные баны, разбан, снятие верификации, теневой бан, блок номеров, удержание данных',
  owner: 'Плюс управление командой и выгрузки для юридических запросов',
}

// Temporary bans a moderator may give; longer and permanent bans need an admin.
export const MODERATOR_MAX_BAN_DAYS = 7
