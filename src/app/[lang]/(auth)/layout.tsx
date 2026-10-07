import { Heart } from 'lucide-react'

export default function AuthLayout({ children }: LayoutProps<'/[lang]'>) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-8 flex items-center gap-2">
        <Heart className="fill-accent text-accent size-7" aria-hidden />
        <span className="text-2xl font-bold tracking-tight">Vibely</span>
      </header>
      {children}
    </main>
  )
}
