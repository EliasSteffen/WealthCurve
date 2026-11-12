import { TrendingUp, Wallet } from 'lucide-react'
import { actions, type AppPage } from '../core/state'
import { useTheme } from '../hooks/useTheme'
import { cn } from '../lib/cn'
import { useT } from '../react/localeContext'
import { useDispatch, useSelector } from '../react/useSelector'
import { DepotPage } from './depot/DepotPage'
import { SettingsDialog } from './layout/SettingsDialog'
import { SparplanPage } from './sparplan/SparplanPage'
import { Logo } from './ui/Logo'

/**
 * Zwei Bereiche, eine Kopfzeile.
 *
 * „Sparplan" rechnet die Zukunft eines Plans, „Mein Depot" durchleuchtet, was
 * man heute hält. Beide teilen sich Szenarien (das Depot kann eines anlegen),
 * aber nicht den Bildschirm: zusammen auf einer Seite war keines von beiden
 * auffindbar.
 *
 * Gescrollt wird der Inhalt, nicht die Seite - die Kopfzeile bleibt stehen.
 */
export function Dashboard() {
  const { theme, setTheme } = useTheme()
  const t = useT()
  const dispatch = useDispatch()
  const page = useSelector((s) => s.page)

  const bereiche: readonly { id: AppPage; label: string; Icon: typeof Wallet }[] = [
    { id: 'sparplan', label: t('nav.plan', 'Sparplan'), Icon: TrendingUp },
    { id: 'depot', label: t('nav.depot', 'Mein Depot'), Icon: Wallet },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--hairline)] px-4 py-2.5 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo size={26} />
          <h1 className="truncate text-base font-semibold text-[var(--text-primary)] lg:text-lg">
            {t('app.title', 'Zinseszins')}
          </h1>
        </div>

        {/* Auf dem Handy eine eigene Zeile über die volle Breite: zwei große Ziele statt zwei kleiner. */}
        <nav aria-label={t('nav.label', 'Bereiche')} className="order-last flex w-full gap-1 sm:order-none sm:w-auto">
          {bereiche.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={page === id ? 'page' : undefined}
              onClick={() => dispatch(actions.setPage(id))}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none',
                page === id
                  ? 'bg-[var(--grid)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--grid)]',
              )}
            >
              <Icon size={15} aria-hidden />
              {label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <SettingsDialog theme={theme} onThemeChange={setTheme} showVideo={page === 'sparplan'} />
        </div>
      </header>

      {/* key: ein Bereichswechsel beginnt oben, nicht an der Scrollposition des anderen. */}
      <main key={page} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {page === 'depot' ? <DepotPage /> : <SparplanPage />}
      </main>
    </div>
  )
}
