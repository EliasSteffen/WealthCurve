import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface CardProps {
  readonly children: ReactNode
  readonly className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function CardTitle({ children }: { readonly children: ReactNode }) {
  return (
    <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
      {children}
    </h2>
  )
}
