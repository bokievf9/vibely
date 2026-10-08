'use client'

import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useOptionalI18n } from '@/i18n/client'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

// Bottom sheet on phones, centered dialog on wider screens.
export function Modal({ open, onClose, title, children }: ModalProps) {
  // Admin panel renders without the i18n provider and is Russian-only.
  const closeLabel = useOptionalI18n()?.dict.common.close ?? 'Закрыть'
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3 } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="bg-surface relative w-full max-w-md rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } }}
            exit={{ y: '100%', transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] } }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="active:bg-border -m-1 rounded-full p-2 transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
