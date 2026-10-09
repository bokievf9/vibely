'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { LocaleLink } from '@/i18n/client'
import { cn } from '@/lib/utils'
import { headerActionClassName } from './header-styles'

type PageHeaderProps = {
  title: string
  /** A back chevron on the left (iOS push navigation); the large title then sits under the bar. */
  back?: { href: string; label: string }
  /** Actions on the right of the bar (44px icon buttons). */
  children?: ReactNode
  /**
   * Replaces the large title on the left of the bar (e.g. the Solo/Duo switch on Discover). The
   * title stays the page heading for screen readers; the bottom nav already names the tab.
   */
  leading?: ReactNode
  className?: string
}

// iOS large-title header. At rest the 34px title owns the top of the screen (on the same row as the
// actions, or under the back button). Once content scrolls, the bar turns into a blurred material
// with a hairline and a compact 17px title fades in; the large title fades out beneath it. Plain
// opacity transitions, so reduced motion needs nothing extra.
export function PageHeader({ title, back, leading, children, className }: PageHeaderProps) {
  const titleRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // No title row with a `leading` control: the bar only turns into material on scroll.
    const row = titleRef.current
    let frame = 0
    const update = () => {
      frame = 0
      // With a back button the large title is its own row: collapse when most of it is under the
      // bar. Without one it shares the bar's row, so the first few pixels of scroll collapse it.
      const limit = back && row ? row.offsetHeight * 0.6 : 6
      setCollapsed(window.scrollY > limit)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [back])

  return (
    <>
      <header
        data-collapsed={collapsed || undefined}
        className={cn(
          'group/header sticky top-0 z-30 flex h-[var(--header-h)] shrink-0 items-center gap-1 px-2 pt-[env(safe-area-inset-top)]',
          className,
        )}
      >
        <span
          aria-hidden
          className="material-bar pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 ease-out group-data-collapsed/header:opacity-100"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.07] opacity-0 transition-opacity duration-200 ease-out group-data-collapsed/header:opacity-100"
        />
        {leading && !back && (
          <div className="relative flex min-w-0 items-center pl-2">{leading}</div>
        )}
        {back && (
          <LocaleLink
            href={back.href}
            aria-label={back.label}
            className={cn(headerActionClassName, '-ml-0.5')}
          >
            <ChevronLeft className="size-7" strokeWidth={2.2} />
          </LocaleLink>
        )}
        {!leading && (
          <span
            aria-hidden
            className="text-headline pointer-events-none absolute inset-x-16 bottom-0 flex h-[3.25rem] translate-y-1 items-center justify-center truncate opacity-0 transition-[opacity,translate] duration-200 ease-out group-data-collapsed/header:translate-y-0 group-data-collapsed/header:opacity-100"
          >
            <span className="truncate">{title}</span>
          </span>
        )}
        {children && <div className="relative ml-auto flex items-center gap-0.5">{children}</div>}
      </header>
      {leading && !back ? (
        <h1 className="sr-only">{title}</h1>
      ) : (
        <div
          ref={titleRef}
          className={cn(
            'relative z-20 flex items-center px-4 transition-opacity duration-200 ease-out',
            back
              ? 'pt-1 pb-3'
              : // Shares the bar's row: pulled up under the (transparent at rest) bar.
                'pointer-events-none -mt-[3.25rem] h-[3.25rem]',
            children && !back && 'pr-36',
            collapsed && 'opacity-0',
          )}
        >
          <h1 className="text-display truncate">{title}</h1>
        </div>
      )}
    </>
  )
}
