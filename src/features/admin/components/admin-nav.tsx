'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, Flag, History, LayoutDashboard, ScanFace, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/admin', label: 'Обзор', icon: LayoutDashboard },
  { href: '/admin/verification', label: 'Верификация', icon: ScanFace },
  { href: '/admin/reports', label: 'Жалобы', icon: Flag },
  { href: '/admin/users', label: 'Пользователи', icon: Users },
  { href: '/admin/content', label: 'Контент', icon: FileText },
  { href: '/admin/log', label: 'Журнал', icon: History },
] as const

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Разделы модерации" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {LINKS.map(({ href, label, icon: Icon }) => {
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
