'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { PhoneScreen } from './phone-screen'

type Step = { title: string; text: string; alt: string; src: string }

// Three steps in reading order. On wide screens the phone stays pinned beside the steps and
// crossfades to the screen of the step in the middle of the viewport (IntersectionObserver, no
// scroll listener); the other steps dim. On phones each step carries its own screenshot.
// Reduced motion keeps the crossfade (opacity only), nothing moves.
export function BlindStory({ title, steps }: { title: string; steps: Step[] }) {
  const [active, setActive] = useState(0)
  const refs = useRef<(HTMLLIElement | null)[]>([])

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = Number((entry.target as HTMLElement).dataset.index)
          if (!Number.isNaN(index)) setActive(index)
        }
      },
      // A thin band across the middle of the viewport decides which step is current.
      { rootMargin: '-45% 0px -45% 0px' },
    )
    for (const el of refs.current) if (el) io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <section
      aria-labelledby="story-title"
      className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28"
    >
      <h2
        id="story-title"
        className="text-3xl font-bold tracking-[-0.03em] text-balance md:text-[2.5rem]"
      >
        {title}
      </h2>
      <div className="mt-10 md:mt-4 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
        <div className="hidden md:block">
          <div className="sticky top-[max(6rem,calc(50dvh-19rem))] mx-auto w-[280px] lg:w-[300px]">
            <div className="relative">
              {steps.map((step, i) => (
                <PhoneScreen
                  key={step.src}
                  src={step.src}
                  alt={i === active ? step.alt : ''}
                  sizes="300px"
                  className={cn(
                    'transition-opacity duration-500 ease-out',
                    i === 0 ? 'relative' : 'absolute inset-0',
                    i === active ? 'opacity-100' : 'opacity-0',
                  )}
                />
              ))}
            </div>
          </div>
        </div>
        <ol className="flex flex-col gap-12 md:gap-0">
          {steps.map((step, i) => (
            <li
              key={step.title}
              ref={(el) => {
                refs.current[i] = el
              }}
              data-index={i}
              className="md:flex md:min-h-[min(72dvh,40rem)] md:flex-col md:justify-center"
            >
              <div
                className={cn(
                  'border-l-2 pl-5 transition-[opacity,border-color] duration-300 ease-out md:pl-7',
                  i === active ? 'border-accent' : 'border-border md:opacity-45',
                )}
              >
                <h3 className="text-title2 md:text-title">{step.title}</h3>
                <p className="text-muted text-body mt-3 max-w-[44ch] text-pretty md:text-lg">
                  {step.text}
                </p>
              </div>
              {/* Phones: the top of the screen is enough to show the step; the rest fades out. */}
              <div className="mt-6 ml-5 h-[19rem] w-[min(60vw,220px)] overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)] md:hidden">
                <PhoneScreen src={step.src} alt={step.alt} sizes="60vw" />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
