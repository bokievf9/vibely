import type { LandingDictionary } from '@/i18n/dictionaries/landing/en'
import { cn } from '@/lib/utils'
import { container } from './landing-hero'
import { PhoneScreen } from './phone-screen'

type Tile = {
  key: 'blind' | 'discover' | 'feed' | 'duo' | 'statuses'
  src: string
  className: string
  // How far the screenshot slides up inside the tile (% of the phone's height), so the part
  // that tells the story is in view (the status text sits low on its screen).
  shift?: number
}

// Exactly five cells, Blind Dating as the hero tile:
//   lg (3 cols)        md (2 cols)        < md: one column
//   [Blind Blind][Disc] [Blind  Blind]
//   [Blind Blind][Feed] [Disc ][Feed ]
//   [Duo][Stat   Stat ] [Duo  ][Stat ]
const TILES: Tile[] = [
  {
    key: 'blind',
    src: '/landing/screens/blind-date.webp',
    className: 'md:col-span-2 lg:row-span-2',
  },
  { key: 'discover', src: '/landing/screens/discover.webp', className: '' },
  { key: 'feed', src: '/landing/screens/feed.webp', className: '' },
  { key: 'duo', src: '/landing/screens/duo.webp', className: '' },
  { key: 'statuses', src: '/landing/screens/statuses.webp', className: 'lg:col-span-2', shift: 46 },
]

export function WaysBento({ t }: { t: LandingDictionary }) {
  return (
    <section aria-labelledby="ways-title" className={`${container} py-20 md:py-28`}>
      <h2
        id="ways-title"
        className="mb-10 text-3xl font-bold tracking-[-0.03em] text-balance md:text-[2.5rem]"
      >
        {t.ways.title}
      </h2>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[repeat(3,22rem)]">
        {TILES.map((tile) => (
          <BentoTile key={tile.key} tile={tile} copy={t.ways[tile.key]} />
        ))}
      </ul>
    </section>
  )
}

function BentoTile({
  tile,
  copy,
}: {
  tile: Tile
  copy: { title: string; text: string; alt: string }
}) {
  const hero = tile.key === 'blind'
  const wide = tile.key === 'statuses'
  return (
    <li
      className={cn(
        'landing-reveal rounded-card relative isolate flex min-h-[25rem] flex-col overflow-hidden border',
        hero
          ? 'border-accent/30 bg-surface min-h-[34rem] bg-[radial-gradient(90%_70%_at_70%_100%,rgb(255_77_125/0.30),transparent_70%)] md:min-h-[38rem] lg:min-h-0'
          : 'border-border bg-surface bg-[radial-gradient(70%_60%_at_50%_110%,rgb(255_77_125/0.10),transparent_70%)] lg:min-h-0',
        wide && 'lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-6',
        tile.className,
      )}
    >
      <div className={cn('relative p-6 md:p-7', hero && 'md:p-9', wide && 'lg:self-center')}>
        <h3
          className={cn(
            'font-bold tracking-[-0.02em]',
            hero ? 'text-[1.75rem] md:text-[2.25rem]' : 'text-title2',
          )}
        >
          {copy.title}
        </h3>
        <p
          className={cn(
            'text-muted mt-2 text-pretty',
            hero ? 'text-body max-w-[34ch] md:text-lg' : 'text-callout max-w-[40ch]',
          )}
        >
          {copy.text}
        </p>
      </div>
      {/* The phone peeks in from the bottom edge; the tile crops it. */}
      <div className={cn('relative min-h-0 flex-1 overflow-hidden', wide && 'lg:h-full')}>
        <PhoneScreen
          src={tile.src}
          alt={copy.alt}
          sizes={
            hero
              ? '(min-width: 1024px) 300px, (min-width: 768px) 320px, 70vw'
              : '(min-width: 1024px) 220px, 60vw'
          }
          className={cn(
            'absolute left-1/2 -translate-x-1/2',
            hero ? 'top-2 w-[min(72%,300px)] md:w-[300px]' : 'top-0 w-[min(62%,220px)]',
            wide && 'lg:top-6 lg:w-[220px]',
          )}
          style={tile.shift ? { translate: `-50% -${tile.shift}%` } : undefined}
        />
      </div>
    </li>
  )
}
