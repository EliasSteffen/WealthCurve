import { Film, Settings2, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ThemePreference } from '../../hooks/useTheme'
import { useBackdropClose } from '../../lib/backdropClose'
import { cn } from '../../lib/cn'
import { rovingKeyHandler } from '../../lib/rovingKeys'
import { useT } from '../../react/localeContext'
import { preloadVideoWorkspace } from '../../lib/lazyVideo'
import type { Reiter } from './SettingsDialogContent'

/*
 * Der Inhalt (samt Video-Werkzeug) ist ein eigener Chunk. Geladen wird er
 * schon bei Hover/Fokus auf einen Öffnen-Knopf und sonst im Leerlauf nach dem
 * Start - so ist er beim Klick fast immer da und der Dialog öffnet ohne Flackern.
 */
const loadInhalt = () => import('./SettingsDialogContent')
const SettingsDialogContent = lazy(loadInhalt)
const vorladen = () => void loadInhalt()

// Automatische Aktivierung: der Fokus-Wechsel löst per click() die Auswahl aus.
const onTabKeyDown = rovingKeyHandler('[role="tab"]', true)
const PANEL_ID = 'settings-tabpanel'
const tabId = (id: Reiter) => `settings-tab-${id}`

/**
 * Was die ganze App betrifft, nicht einen Plan: Sprache, Farbschema, Teilen,
 * Zurücksetzen - und das Video.
 *
 * Woran man beim Rechnen dreht, steht im Plan-Formular des Sparplans selbst.
 * Früher lagen dieselben Regler zusätzlich hier und in einer Seitenspalte; drei
 * Wege zu denselben Reglern hießen dreimal „Einstellungen“.
 *
 * Beide Knöpfe der Kopfzeile gehören in diese Komponente, weil sie denselben
 * Dialog öffnen - nur auf verschiedenen Reitern. Zwei Komponenten mit je einem
 * <dialog> wären zwei Dialoge, von denen einer immer der falsche ist.
 */
export function SettingsDialog({
  theme,
  onThemeChange,
  showVideo = true,
}: {
  readonly theme: ThemePreference
  readonly onThemeChange: (value: ThemePreference) => void
  /** Das Video zeigt die Vermögenskurve - auf der Depot-Seite gibt es keine. */
  readonly showVideo?: boolean
}) {
  const t = useT()
  const [offen, setOffen] = useState(false)
  const [reiter, setReiter] = useState<Reiter>('allgemein')
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const id = window.setTimeout(vorladen, 2000)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (offen && !dialog.open) dialog.showModal()
    if (!offen && dialog.open) dialog.close()
  }, [offen])

  const backdrop = useBackdropClose(dialogRef, () => setOffen(false))

  const oeffnen = (ziel: Reiter) => {
    setReiter(ziel)
    setOffen(true)
  }

  const reiterListe: readonly { id: Reiter; label: string }[] = [
    { id: 'allgemein', label: t('settings.tab.general', 'Allgemein') },
    { id: 'video', label: t('settings.tab.video', 'Video') },
  ]

  const kopfKnopf =
    'flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] px-2.5 py-1.5 ' +
    'text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--grid)]'

  return (
    <>
      <button
        type="button"
        onClick={() => oeffnen('allgemein')}
        onPointerEnter={vorladen}
        onFocus={vorladen}
        className={kopfKnopf}
        aria-label={t('settings.title', 'Einstellungen')}
      >
        <Settings2 size={14} aria-hidden />
        <span className="hidden sm:inline">{t('settings.title', 'Einstellungen')}</span>
      </button>
      {showVideo ? (
      <button
        type="button"
        onClick={() => oeffnen('video')}
        onPointerEnter={() => {
          vorladen()
          preloadVideoWorkspace()
        }}
        onFocus={() => {
          vorladen()
          preloadVideoWorkspace()
        }}
        className={kopfKnopf}
      >
        <Film size={14} aria-hidden />
        {t('video.open', 'Video')}
      </button>
      ) : null}

      <dialog
        ref={dialogRef}
        onClose={() => setOffen(false)}
        {...backdrop}
        className="app-dialog"
        aria-label={t('settings.title', 'Einstellungen')}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--hairline)] px-4 py-2.5">
          <div role="tablist" aria-label={t('settings.title', 'Einstellungen')} className="flex gap-0.5" onKeyDown={onTabKeyDown}>
            {reiterListe.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={tabId(id)}
                aria-selected={reiter === id}
                aria-controls={PANEL_ID}
                tabIndex={reiter === id ? 0 : -1}
                onClick={() => setReiter(id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  reiter === id
                    ? 'bg-[var(--grid)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--grid)]/60',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOffen(false)}
            aria-label={t('dialog.close', 'Schließen')}
            className="flex size-10 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--text-primary)]"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {/*
          Erst beim Öffnen montieren: die Vorschau des Videos zeichnet in einer
          Schleife. Sie soll nicht mitlaufen, während der Dialog zu ist.
        */}
        <div
          role="tabpanel"
          id={PANEL_ID}
          aria-labelledby={tabId(reiter)}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4"
        >
          {offen ? (
            <Suspense fallback={null}>
              <SettingsDialogContent reiter={reiter} theme={theme} onThemeChange={onThemeChange} />
            </Suspense>
          ) : null}
        </div>
      </dialog>
    </>
  )
}
