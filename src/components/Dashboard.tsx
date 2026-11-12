import { ChartCandlestick, TrendingUp, Wallet } from 'lucide-react'
import { lazy, Suspense, useLayoutEffect } from 'react'
import { actions, type AppPage } from '../core/state'
import { useTheme } from '../hooks/useTheme'
import { cn } from '../lib/cn'
import { useT } from '../react/localeContext'
import { useDispatch, useSelector } from '../react/useSelector'
import { DepotPage } from './depot/DepotPage'
import { SettingsDialog } from './layout/SettingsDialog'
import { SparplanPage } from './sparplan/SparplanPage'
import { Logo } from './ui/Logo'

/*
 * Die Pro-Ansicht samt TradingView-Bibliothek ist ein eigener Chunk - wer sie
 * nie einschaltet, lädt sie nie.
 */
const ProWorkspace = lazy(() => import('./pro/ProWorkspace').then((m) => ({ default: m.ProWorkspace })))

/** Schaltet den Pro-Modus: Terminal-Ansicht und die dazugehörigen Farben. */
function ProToggle() {
  const t = useT()
  const dispatch = useDispatch()
  const proMode = useSelector((s) => s.proMode)
  return (
    <button
      type="button"
      aria-pressed={proMode}
      onClick={() => dispatch(actions.setProMode(!proMode))}
      title={t('pro.toggleHint', 'Terminal-Ansicht mit TradingView-Charts, Kennzahlen und Kerzencharts')}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold tracking-wide transition-colors',
        proMode
          ? 'border-transparent bg-[var(--accent-fill)] text-[var(--on-accent)] hover:opacity-90'
          : 'border-[var(--hairline)] text-[var(--text-secondary)] hover:bg-[var(--grid)] hover:text-[var(--text-primary)]',
      )}
    >
      <ChartCandlestick size={14} aria-hidden />
      {t('pro.toggle', 'Pro')}
      {/* Ein kleiner Schalter: der Zustand ist auch ohne Farbe erkennbar. */}
      <span
        aria-hidden
        className={cn(
          'relative ml-0.5 inline-block h-3 w-5 rounded-full transition-colors',
          proMode ? 'bg-[color-mix(in_srgb,var(--on-accent)_35%,transparent)]' : 'bg-[var(--grid)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-2 w-2 rounded-full transition-[left]',
            proMode ? 'left-2.5 bg-[var(--on-accent)]' : 'left-0.5 bg-[var(--text-muted)]',
          )}
        />
      </span>
    </button>
  )
}

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
  const proMode = useSelector((s) => s.proMode)

  // Vor dem Zeichnen setzen, damit die Pro-Farben ab dem ersten Bild stimmen.
  useLayoutEffect(() => {
    const root = document.documentElement
    if (proMode) root.setAttribute('data-pro', '')
    else root.removeAttribute('data-pro')
    return () => root.removeAttribute('data-pro')
  }, [proMode])

  const bereiche: readonly { id: AppPage; label: string; Icon: typeof Wallet }[] = [
    { id: 'sparplan', label: t('nav.plan', 'Sparplan'), Icon: TrendingUp },
    { id: 'depot', label: t('nav.depot', 'Mein Depot'), Icon: Wallet },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header
        className={cn(
          'flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--hairline)] px-4 py-2.5 lg:px-6',
          // Im Terminal ist jede Zeile Platz für den Chart.
          proMode && 'bg-[var(--surface-1)] py-1.5 lg:px-4',
        )}
      >
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
          <ProToggle />
          <SettingsDialog theme={theme} onThemeChange={setTheme} showVideo={page === 'sparplan'} />
        </div>
      </header>

      {/* key: ein Bereichswechsel beginnt oben, nicht an der Scrollposition des anderen. */}
      <main
        key={`${page}-${proMode}`}
        className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', proMode && page === 'sparplan' && 'lg:overflow-hidden')}
      >
        {page === 'depot' ? (
          <DepotPage />
        ) : proMode ? (
          <Suspense fallback={<p className="p-6 text-sm text-[var(--text-muted)]">{t('pro.loading', 'Terminal lädt …')}</p>}>
            <ProWorkspace />
          </Suspense>
        ) : (
          <SparplanPage />
        )}
      </main>
    </div>
  )
}
