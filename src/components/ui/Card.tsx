import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface CardProps {
  readonly children: ReactNode
  readonly className?: string
  /**
   * `false` erzeugt gar kein Padding.
   *
   * Nicht über `className="p-0"` lösbar: tailwind-merge lässt ein
   * unpräfigiertes `p-0` das `sm:p-5` nicht überschreiben, weil beide zu
   * verschiedenen Modifier-Gruppen gehören. Ab 640 px bliebe der Innenabstand
   * also stehen - genau der Grund, warum eingeklappte Karten weiter als fette
   * leere Box dastanden.
   */
  readonly padded?: boolean
}

export function Card({ children, className, padded = true }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)]',
        padded && 'p-4 sm:p-5',
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
