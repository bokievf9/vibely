'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/utils'

// Promo video in the hero phone. The poster (next/image, preloaded) is what paints first and is
// the LCP candidate; the video sources are only attached after the page has loaded and the main
// thread is idle, so the video never competes with first paint. It plays only while visible,
// and not at all for reduced motion or Save-Data: those visitors keep the poster.
export function HeroVideo({ label }: { label: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [load, setLoad] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ===
      true
    if (reduce || saveData) return
    let idle: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const start = () => {
      if ('requestIdleCallback' in window) {
        idle = window.requestIdleCallback(() => setLoad(true), { timeout: 2500 })
      } else {
        timer = setTimeout(() => setLoad(true), 300)
      }
    }
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
    return () => {
      window.removeEventListener('load', start)
      if (idle !== undefined) window.cancelIdleCallback(idle)
      if (timer) clearTimeout(timer)
    }
  }, [])

  // Play while on screen, pause when scrolled away (battery, data).
  useEffect(() => {
    const el = video.current
    if (!load || !el) return
    el.load()
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void el.play().catch(() => {})
      else el.pause()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [load])

  return (
    // The promo is a full 9:16 composition with its own phone and captions: no extra bezel.
    <div
      role="img"
      aria-label={label}
      className="relative aspect-[9/16] overflow-hidden rounded-[1.75rem] bg-[#0e0b10] shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_40px_80px_-32px_rgb(0_0_0/0.95)]"
    >
      <div className="relative size-full">
        <Image
          src="/landing/hero-poster.webp"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 330px, (min-width: 768px) 300px, 280px"
          className="object-cover"
        />
        <video
          ref={video}
          aria-hidden
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          onPlaying={() => {
            if (!playing) track('video_play')
            setPlaying(true)
          }}
          className={cn(
            'absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 ease-out',
            playing && 'opacity-100',
          )}
        >
          {load && (
            <>
              <source src="/landing/hero.webm" type="video/webm" />
              <source src="/landing/hero.mp4" type="video/mp4" />
            </>
          )}
        </video>
      </div>
    </div>
  )
}
