'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarHeart,
  Crown,
  FileText,
  Flag,
  History,
  Images,
  Lightbulb,
  ListChecks,
  LayoutDashboard,
  PhoneOff,
  Scale,
  ScanFace,
  Smile,
  Send,
  Ticket,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { hasRole, type AdminRole } from '../roles'

type NavLink = { href: string; label: string; icon: LucideIcon; min?: AdminRole }

// One entry per section; `min` hides it from lower roles (the page itself checks again).
// To add a section, append a line here.
const LINKS: NavLink[] = [
  { href: '/admin', label: 'Обзор', icon: LayoutDashboard },
  { href: '/admin/verification', label: 'Верификация', icon: ScanFace },
  { href: '/admin/reports', label: 'Жалобы', icon: Flag },
  { href: '/admin/appeals', label: 'Апелляции', icon: Scale },
  { href: '/admin/photos', label: 'Фото', icon: Images },
  { href: '/admin/users', label: 'Пользователи', icon: Users },
  { href: '/admin/content', label: 'Контент', icon: FileText },
  { href: '/admin/prompts', label: 'Вопрос дня', icon: Lightbulb },
  { href: '/admin/statuses', label: 'Статусы', icon: Smile },
  { href: '/admin/log', label: 'Журнал', icon: History },
  { href: '/admin/telegram', label: 'Telegram', icon: Send },
  { href: '/admin/events', label: 'Вечера', icon: CalendarHeart },
  { href: '/admin/waitlist', label: 'Лист ожидания', icon: ListChecks },
  { href: '/admin/duo', label: 'Дуо', icon: UsersRound },
  { href: '/admin/blocklist', label: 'Блок-лист', icon: PhoneOff, min: 'admin' },
  { href: '/admin/promo', label: 'Промокоды', icon: Ticket, min: 'admin' },
  { href: '/admin/plans', label: 'Планы', icon: Crown, min: 'admin' },
  { href: '/admin/team', label: 'Команда', icon: UserCog, min: 'owner' },
]

export function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Разделы модерации" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {LINKS.filter((l) => !l.min || hasRole(role, l.min)).map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? pathname === href : pathname.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap',
                  active ? 'bg-accent text-accent-foreground' : 'bg-surface text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
