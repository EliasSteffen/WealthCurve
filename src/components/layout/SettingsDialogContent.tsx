import { Check, Link2, RotateCcw } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { actions } from '../../core/state'
import type { ThemePreference } from '../../hooks/useTheme'
import { loadVideoWorkspace } from '../../lib/lazyVideo'
import { buildShareUrl, copyText } from '../../lib/persistence'
import { useT } from '../../react/localeContext'
import { useStore } from '../../react/storeContext'
import { useDispatch } from '../../react/useSelector'
import { LocaleToggle } from '../LocaleToggle'
import { ThemeToggle } from '../ThemeToggle'
import { SettingsPanel } from './SettingsPanel'

export type Reiter = 'diagramm' | 'video' | 'allgemein'

/** Eigener Chunk: das Video-Werkzeug (Canvas, Encoder) braucht, wer nie ein Video macht, nicht. */
const VideoWorkspace = lazy(loadVideoWorkspace)

const knopf =
  'flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] px-2.5 py-1.5 ' +
  'text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--grid)]'

/**
 * Inhalt der drei Reiter. Liegt in einer eigenen Datei, damit `SettingsDialog`
 * ihn per `React.lazy` nachladen kann; die Kopfzeilen-Knöpfe und das <dialog>
 * bleiben im Hauptbündel.
 */
export default function SettingsDialogContent({
  reiter,
  theme,
  onThemeChange,
}: {
  readonly reiter: Reiter
  readonly theme: ThemePreference
  readonly onThemeChange: (value: ThemePreference) => void
}) {
  return (
    <>
      {reiter === 'diagramm' ? <SettingsPanel layout="breit" /> : null}
      {reiter === 'video' ? (
        <Suspense fallback={null}>
          <VideoWorkspace />
        </Suspense>
      ) : null}
      {reiter === 'allgemein' ? <AllgemeinReiter theme={theme} onThemeChange={onThemeChange} /> : null}
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

  return (
    <div className="max-w-md space-y-6">
      <Feld label={t('locale.label', 'Sprache')} hint={t('locale.hint', 'Beschriftungen und Zahlenformat.')}>
        <LocaleToggle />
      </Feld>

      <Feld
        label={t('theme.label', 'Farbschema')}
        hint={t('theme.hint', '„System" folgt der Einstellung des Betriebssystems.')}
      >
        <ThemeToggle theme={theme} onChange={onThemeChange} />
      </Feld>

      <Feld
        label={t('share.label', 'Teilen')}
        hint={t(
          'share.hint',
          'Kopiert einen Link mit Szenarien und Einstellungen. Kursdaten sind nicht enthalten.',
        )}
      >
        <ShareKnopf />
      </Feld>

      <Feld
        label={t('app.reset', 'Zurücksetzen')}
        hint={t(
          'app.reset.hint',
          'Setzt Szenarien, Kurven und alle Einstellungen auf den Ausgangszustand zurück.',
        )}
      >
        <ResetKnopf />
      </Feld>
    </div>
  )
}

function ShareKnopf() {
  const t = useT()
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
    // Der Fallback bleibt stehen: der Link muss in Ruhe markiert werden können.
    if (ok) timer.current = setTimeout(() => setStatus('idle'), 2000)
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => void teilen()} className={knopf}>
        {status === 'kopiert' ? <Check size={14} aria-hidden /> : <Link2 size={14} aria-hidden />}
        {status === 'kopiert' ? t('share.copied', 'Link kopiert') : t('share.copy', 'Link teilen')}
      </button>
      <span role="status" className="sr-only">
        {status === 'kopiert' ? t('share.copied', 'Link kopiert') : ''}
      </span>
      {status === 'manuell' ? (
        <label className="block text-[11px] text-[var(--text-muted)]">
          {t('share.manual', 'Kopieren nicht möglich – Link bitte von Hand kopieren:')}
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 w-full rounded-md border border-[var(--hairline)] bg-transparent px-2 py-1 text-xs text-[var(--text-primary)]"
          />
        </label>
      ) : null}
    </div>
  )
}

/** Zweistufig inline: ein versehentlicher Klick löscht sonst alle Szenarien. */
function ResetKnopf() {
  const t = useT()
  const dispatch = useDispatch()
  const [fragen, setFragen] = useState(false)

  if (!fragen) {
    return (
      <button type="button" onClick={() => setFragen(true)} className={knopf}>
        <RotateCcw size={14} aria-hidden />
        {t('app.reset', 'Zurücksetzen')}
      </button>
    )
  }
  return (
    <div
      role="group"
      aria-label={t('app.reset.confirm', 'Wirklich zurücksetzen?')}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-xs font-medium text-[var(--text-primary)]">
        {t('app.reset.confirm', 'Wirklich zurücksetzen?')}
      </span>
      <button
        type="button"
        autoFocus
        onClick={() => {
          dispatch(actions.reset())
          setFragen(false)
        }}
        className={knopf}
      >
        {t('app.reset.yes', 'Ja, zurücksetzen')}
      </button>
      <button type="button" onClick={() => setFragen(false)} className={knopf}>
        {t('app.reset.cancel', 'Abbrechen')}
      </button>
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
