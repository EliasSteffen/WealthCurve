import { Film, RotateCcw, Settings2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { actions } from '../../core/state'
import type { ThemePreference } from '../../hooks/useTheme'
import { cn } from '../../lib/cn'
import { useT } from '../../react/localeContext'
import { useDispatch } from '../../react/useSelector'
import { LocaleToggle } from '../LocaleToggle'
import { ThemeToggle } from '../ThemeToggle'
import { VideoWorkspace } from '../video/VideoWorkspace'
import { SettingsPanel } from './SettingsPanel'

type Reiter = 'diagramm' | 'video' | 'allgemein'

/**
 * Alle Einstellungen an einem Ort, in drei Reitern.
 *
 * Warum überhaupt, wo es doch die Seitenspalte gibt: die Spalte ist 320 px
 * breit und trägt genau das, woran man beim Betrachten des Diagramms dreht.
 * Alles andere - die Einstellungen des Videos, Sprache, Farbschema - hatte
 * keinen Platz und verteilte sich auf die Kopfzeile und einen eigenen Dialog.
 * Hier ist Breite, und die beiden Bereiche der Diagramm-Einstellungen stehen
 * endlich wirklich nebeneinander statt untereinander.
 *
 * Die Seitenspalte bleibt, was sie war: der schnelle Zugriff. Sie zeigt
 * dieselbe Komponente, nur schmal.
 *
 * Beide Knöpfe der Kopfzeile gehören in diese Komponente, weil sie denselben
 * Dialog öffnen - nur auf verschiedenen Reitern. Zwei Komponenten mit je einem
 * <dialog> wären zwei Dialoge, von denen einer immer der falsche ist.
 */
export function SettingsDialog({
  theme,
  onThemeChange,
}: {
  readonly theme: ThemePreference
  readonly onThemeChange: (value: ThemePreference) => void
}) {
  const t = useT()
  const [offen, setOffen] = useState(false)
  const [reiter, setReiter] = useState<Reiter>('diagramm')
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (offen && !dialog.open) dialog.showModal()
    if (!offen && dialog.open) dialog.close()
  }, [offen])

  const oeffnen = (ziel: Reiter) => {
    setReiter(ziel)
    setOffen(true)
  }

  const reiterListe: readonly { id: Reiter; label: string }[] = [
    { id: 'diagramm', label: t('settings.tab.chart', 'Diagramm') },
    { id: 'video', label: t('settings.tab.video', 'Video') },
    { id: 'allgemein', label: t('settings.tab.general', 'Allgemein') },
  ]

  const kopfKnopf =
    'flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] px-2.5 py-1.5 ' +
    'text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--grid)]'

  return (
    <>
      <button type="button" onClick={() => oeffnen('diagramm')} className={kopfKnopf}>
        <Settings2 size={14} aria-hidden />
        {t('settings.title', 'Einstellungen')}
      </button>
      <button type="button" onClick={() => oeffnen('video')} className={kopfKnopf}>
        <Film size={14} aria-hidden />
        {t('video.open', 'Video')}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOffen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOffen(false)
        }}
        className="app-dialog"
        aria-label={t('settings.title', 'Einstellungen')}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--hairline)] px-4 py-2.5">
          <div
            role="tablist"
            aria-label={t('settings.title', 'Einstellungen')}
            className="flex gap-0.5"
          >
            {reiterListe.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={reiter === id}
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
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4">
          {offen && reiter === 'diagramm' ? <SettingsPanel layout="breit" /> : null}
          {offen && reiter === 'video' ? <VideoWorkspace /> : null}
          {offen && reiter === 'allgemein' ? (
            <AllgemeinReiter theme={theme} onThemeChange={onThemeChange} />
          ) : null}
        </div>
      </dialog>
    </>
  )
}

/** Was weder das Diagramm noch das Video betrifft, sondern die Anwendung. */
function AllgemeinReiter({
  theme,
  onThemeChange,
}: {
  readonly theme: ThemePreference
  readonly onThemeChange: (value: ThemePreference) => void
}) {
  const t = useT()
  const dispatch = useDispatch()

  return (
    <div className="max-w-md space-y-6">
      <Feld
        label={t('locale.label', 'Sprache')}
        hint={t('locale.hint', 'Beschriftungen und Zahlenformat.')}
      >
        <LocaleToggle />
      </Feld>

      <Feld
        label={t('theme.label', 'Farbschema')}
        hint={t('theme.hint', '„System" folgt der Einstellung des Betriebssystems.')}
      >
        <ThemeToggle theme={theme} onChange={onThemeChange} />
      </Feld>

      <Feld
        label={t('app.reset', 'Zurücksetzen')}
        hint={t(
          'app.reset.hint',
          'Setzt Szenarien, Kurven und alle Einstellungen auf den Ausgangszustand zurück.',
        )}
      >
        <button
          type="button"
          onClick={() => dispatch(actions.reset())}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--grid)]"
        >
          <RotateCcw size={14} aria-hidden />
          {t('app.reset', 'Zurücksetzen')}
        </button>
      </Feld>
    </div>
  )
}

function Feld({
  label,
  hint,
  children,
}: {
  readonly label: string
  readonly hint: string
  readonly children: ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">{label}</div>
      {children}
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-muted)]">{hint}</p>
    </div>
  )
}
