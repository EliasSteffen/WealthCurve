import {
  ChartArea,
  Check,
  Download,
  Film,
  Languages,
  Link2,
  Monitor,
  Moon,
  MoreHorizontal,
  RotateCcw,
  Search,
  Sun,
  Wallet,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { projectionToCsv } from '../../core/csv'
import { selectProjection } from '../../core/derive'
import { actions, type AppPage } from '../../core/state'
import type { ThemePreference } from '../../hooks/useTheme'
import { cn } from '../../lib/cn'
import { downloadCsv } from '../../lib/download'
import { preloadVideoWorkspace } from '../../lib/lazyVideo'
import { buildShareUrl, copyText } from '../../lib/persistence'
import { isMac } from '../../lib/platform'
import { useLocale, useT } from '../../react/localeContext'
import { useStore } from '../../react/storeContext'
import { useDispatch, useSelector } from '../../react/useSelector'
import { LocaleToggle } from '../LocaleToggle'
import { ThemeToggle } from '../ThemeToggle'
import { Logo } from '../ui/Logo'
import { Menu } from '../ui/Menu'
import { ConfirmDialog } from './ConfirmDialog'

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system']
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor } as const


/** Link mit Plan in die Zwischenablage; misslingt das, steht er zum Abschreiben da. */
function useShare() {
  const store = useStore()
  const [status, setStatus] = useState<'idle' | 'kopiert' | 'manuell'>('idle')
  const [link, setLink] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const teilen = async () => {
    const url = buildShareUrl(store.getSnapshot(), window.location)
    setLink(url)
    const ok = await copyText(url)
    setStatus(ok ? 'kopiert' : 'manuell')
    clearTimeout(timer.current)
    if (ok) timer.current = setTimeout(() => setStatus('idle'), 2000)
  }
  return { status, link, teilen, schliessen: () => setStatus('idle') }
}

/**
 * Die einzige Kopfzeile: Marke, Bereiche, und was die ganze App betrifft.
 *
 * Kein Einstellungsdialog mehr - Sprache und Farbschema stehen direkt hier,
 * Teilen ist ein Knopf, Seltenes (CSV, Zurücksetzen) liegt im Menü. Woran man
 * beim Rechnen dreht, steht auf der Seite selbst.
 */
export function TopBar({
  theme,
  onThemeChange,
  onOpenPalette,
}: {
  readonly theme: ThemePreference
  readonly onThemeChange: (value: ThemePreference) => void
  readonly onOpenPalette: () => void
}) {
  const t = useT()
  const { locale, setLocale } = useLocale()
  const dispatch = useDispatch()
  const store = useStore()
  const page = useSelector((s) => s.page)
  const share = useShare()
  const [resetFragen, setResetFragen] = useState(false)

  const bereiche: readonly { id: AppPage; label: string; short: string; Icon: typeof Wallet }[] = [
    { id: 'sparplan', label: t('nav.plan', 'Sparplan'), short: t('nav.planShort', 'Plan'), Icon: ChartArea },
    { id: 'depot', label: t('nav.depot', 'Mein Depot'), short: t('nav.depotShort', 'Depot'), Icon: Wallet },
    { id: 'video', label: t('nav.video', 'Video'), short: t('nav.video', 'Video'), Icon: Film },
  ]
  const ThemeIcon = THEME_ICON[theme]
  const themeName = {
    light: t('theme.light', 'Hell'),
    dark: t('theme.dark', 'Dunkel'),
    system: t('theme.system', 'System'),
  }[theme]

  return (
    <header className="flex h-11 shrink-0 items-stretch gap-1 border-b border-[var(--grid)] bg-[var(--surface-1)] px-2 sm:gap-2 sm:px-3">
      <div className="flex shrink-0 items-center gap-2 pr-1 sm:pr-2">
        <Logo size={22} />
        <h1 className="hidden text-sm font-semibold tracking-tight text-[var(--text-primary)] sm:block">WealthCurve</h1>
      </div>

      <nav aria-label={t('nav.label', 'Bereiche')} className="flex min-w-0 items-stretch">
        {bereiche.map(({ id, label, short, Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={page === id ? 'page' : undefined}
            // Feste Beschriftung: auf dem Handy steht die Kurzform, vorgelesen wird immer die volle.
            aria-label={label}
            onClick={() => dispatch(actions.setPage(id))}
            onPointerEnter={id === 'video' ? preloadVideoWorkspace : undefined}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-2 text-xs font-medium transition-colors sm:px-3 sm:text-[13px]',
              page === id
                ? 'border-[var(--accent-fill)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            <Icon size={15} aria-hidden className="shrink-0" />
            <span className="md:hidden">{short}</span>
            <span className="hidden md:inline">{label}</span>
          </button>
        ))}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label={t('palette.open', 'Suchen und Befehle')}
          aria-keyshortcuts={isMac() ? 'Meta+K' : 'Control+K'}
          className="flex h-7 items-center gap-2 rounded-md px-1.5 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] md:w-52 md:bg-[var(--surface-2)] md:px-2 md:ring-1 md:ring-inset md:ring-[var(--hairline)] lg:w-64"
        >
          <Search size={14} aria-hidden className="shrink-0" />
          <span className="hidden flex-1 text-left md:inline">{t('palette.placeholder', 'Einstellung oder Befehl …')}</span>
          <kbd className="hidden rounded border border-[var(--hairline)] px-1 font-sans text-[10px] md:inline">
            {isMac() ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>

        <button
          type="button"
          onClick={() => void share.teilen()}
          className="hidden h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--text-primary)] sm:flex"
        >
          {share.status === 'kopiert' ? <Check size={14} aria-hidden /> : <Link2 size={14} aria-hidden />}
          {share.status === 'kopiert' ? t('share.copied', 'Link kopiert') : t('share.copy', 'Link teilen')}
        </button>
        <span role="status" className="sr-only">
          {share.status === 'kopiert' ? t('share.copied', 'Link kopiert') : ''}
        </span>

        <div className="hidden lg:block">
          <LocaleToggle />
        </div>
        <div className="hidden lg:block">
          <ThemeToggle theme={theme} onChange={onThemeChange} />
        </div>

        <Menu
          label={t('menu.more', 'Weitere Aktionen')}
          trigger={<MoreHorizontal size={16} aria-hidden />}
          items={[
            {
              id: 'share',
              label: t('share.copy', 'Link teilen'),
              icon: <Link2 size={14} />,
              onSelect: () => void share.teilen(),
            },
            {
              id: 'locale',
              label: t('locale.label', 'Sprache'),
              meta: locale === 'de' ? 'Deutsch' : 'English',
              icon: <Languages size={14} />,
              onSelect: () => setLocale(locale === 'de' ? 'en' : 'de'),
            },
            {
              id: 'theme',
              label: t('theme.label', 'Farbschema'),
              meta: themeName,
              icon: <ThemeIcon size={14} />,
              onSelect: () => onThemeChange(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]),
            },
            {
              id: 'csv',
              label: t('table.download', 'CSV herunterladen'),
              icon: <Download size={14} />,
              onSelect: () => downloadCsv(projectionToCsv(selectProjection(store.getSnapshot()))),
            },
            'separator',
            {
              id: 'reset',
              label: t('app.resetEllipsis', 'Zurücksetzen …'),
              icon: <RotateCcw size={14} />,
              danger: true,
              onSelect: () => setResetFragen(true),
            },
          ]}
        />
      </div>

      <ConfirmDialog
        open={resetFragen}
        title={t('app.resetTitle', 'Alles zurücksetzen?')}
        text={t(
          'app.reset.hint',
          'Setzt Szenarien, Kurven und alle Einstellungen auf den Ausgangszustand zurück.',
        )}
        confirm={t('app.reset.yes', 'Ja, zurücksetzen')}
        cancel={t('app.reset.cancel', 'Abbrechen')}
        onConfirm={() => {
          dispatch(actions.reset())
          setResetFragen(false)
        }}
        onCancel={() => setResetFragen(false)}
      />

      <ConfirmDialog
        open={share.status === 'manuell'}
        title={t('share.label', 'Teilen')}
        text={t('share.manual', 'Kopieren nicht möglich – Link bitte von Hand kopieren:')}
        cancel={t('dialog.close', 'Schließen')}
        onCancel={share.schliessen}
      >
        <input
          readOnly
          value={share.link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t('share.label', 'Teilen')}
          className="mt-3 h-8 w-full rounded-md border border-[var(--hairline)] bg-[var(--surface-2)] px-2 text-xs text-[var(--text-primary)]"
        />
      </ConfirmDialog>
    </header>
  )
}
