import {
  ChartArea,
  CornerDownLeft,
  Download,
  Film,
  Languages,
  Link2,
  Monitor,
  Moon,
  Plus,
  Search,
  SlidersHorizontal,
  Sun,
  Wallet,
} from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { CHART_STYLES } from '../../core/chart-style'
import { projectionToCsv } from '../../core/csv'
import { selectProjection } from '../../core/derive'
import { WITHDRAWAL_STRATEGIES } from '../../core/domain/withdrawal'
import { slotVar } from '../../core/palette'
import { SETTINGS_CATEGORIES, buildSettingsIndex, type SettingsEntry } from '../../core/settings'
import { MAX_SCENARIOS, actions, type AppPage } from '../../core/state'
import type { ThemePreference } from '../../hooks/useTheme'
import { cn } from '../../lib/cn'
import { downloadCsv } from '../../lib/download'
import { buildShareUrl, copyText } from '../../lib/persistence'
import { revealSetting } from '../../lib/reveal'
import { useBackdropClose } from '../../lib/backdropClose'
import { useLocale, useT } from '../../react/localeContext'
import { useStore } from '../../react/storeContext'
import { useDispatch, useSelector } from '../../react/useSelector'

interface Eintrag {
  readonly id: string
  readonly gruppe: string
  readonly label: string
  /** Weitere Wörter, die zum Eintrag führen - in beiden Sprachen. */
  readonly suche: string
  readonly icon: ReactNode
  readonly meta?: string
  readonly run: () => void
}

/** Ohne Akzente, ohne ß, klein - „jaehrlich" und „Jährlich" finden einander. */
const normal = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')

/** Wohin eine Einstellung führt: Bereich und, wenn es eine gibt, die Stelle darin. */
function ziel(id: string): { page: AppPage; setting?: string } {
  if (id === 'style') return { page: 'video' }
  if (id === 'depot') return { page: 'depot' }
  if (id.startsWith('series:')) return { page: 'sparplan', setting: 'series' }
  return { page: 'sparplan', setting: id }
}

/**
 * Befehlspalette: jede Einstellung, jeder Bereich, jede Aktion über die Tastatur.
 *
 * ⌘K bzw. Strg+K öffnet sie von überall. Getippt wird in der Oberflächensprache,
 * gefunden wird auch auf Deutsch - die Schlagworte des Einstellungsindex
 * gelten in beiden. Eine Einstellung wählen springt an ihre Stelle und setzt den
 * Fokus ins Feld.
 */
export function CommandPalette({
  open,
  onClose,
  theme,
  onThemeChange,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly theme: ThemePreference
  readonly onThemeChange: (value: ThemePreference) => void
}) {
  const t = useT()
  const { locale, setLocale } = useLocale()
  const dispatch = useDispatch()
  const store = useStore()
  const scenarios = useSelector((s) => s.scenarios)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [query, setQuery] = useState('')
  const [aktiv, setAktiv] = useState(0)
  const backdrop = useBackdropClose(dialogRef, onClose)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setQuery('')
      setAktiv(0)
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
      inputRef.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const eintraege = useMemo<Eintrag[]>(() => {
    const gehe = (page: AppPage, setting?: string) => {
      dispatch(actions.setPage(page))
      onClose()
      // Erst nach dem Bereichswechsel steht das Feld im Dokument.
      if (setting) setTimeout(() => revealSetting(setting), 60)
    }
    const bereiche: Eintrag[] = ([
      { id: 'nav:plan', label: t('nav.plan', 'Sparplan'), icon: <ChartArea size={14} />, page: 'sparplan' as const },
      { id: 'nav:depot', label: t('nav.depot', 'Mein Depot'), icon: <Wallet size={14} />, page: 'depot' as const },
      { id: 'nav:video', label: t('nav.video', 'Video'), icon: <Film size={14} />, page: 'video' as const },
    ]).map((b) => ({
      id: b.id,
      gruppe: t('palette.group.pages', 'Bereiche'),
      label: t('palette.goto', 'Gehe zu {page}', { page: b.label }),
      suche: `${b.label} sparplan depot portfolio video plan`,
      icon: b.icon,
      run: () => gehe(b.page),
    }))

    const voll = scenarios.length >= MAX_SCENARIOS
    const aktionen: Eintrag[] = [
      ...(voll
        ? []
        : [
            {
              id: 'act:addScenario',
              gruppe: t('palette.group.actions', 'Aktionen'),
              label: t('scenario.add', 'Szenario hinzufügen'),
              suche: 'szenario neu add new scenario',
              icon: <Plus size={14} />,
              run: () => {
                dispatch(
                  actions.addScenario(
                    t('scenario.fallbackName', `Szenario ${scenarios.length + 1}`, { n: String(scenarios.length + 1) }),
                  ),
                )
                gehe('sparplan')
              },
            },
          ]),
      {
        id: 'act:share',
        gruppe: t('palette.group.actions', 'Aktionen'),
        label: t('share.copy', 'Link teilen'),
        suche: 'teilen link share url kopieren copy',
        icon: <Link2 size={14} />,
        run: () => {
          void copyText(buildShareUrl(store.getSnapshot(), window.location))
          onClose()
        },
      },
      {
        id: 'act:csv',
        gruppe: t('palette.group.actions', 'Aktionen'),
        label: t('table.download', 'CSV herunterladen'),
        suche: 'csv export excel tabelle table download',
        icon: <Download size={14} />,
        run: () => {
          downloadCsv(projectionToCsv(selectProjection(store.getSnapshot())))
          onClose()
        },
      },
      ...(['light', 'dark', 'system'] as const).map((th) => ({
        id: `act:theme:${th}`,
        gruppe: t('palette.group.actions', 'Aktionen'),
        label: t('palette.theme', 'Farbschema: {name}', {
          name: { light: t('theme.light', 'Hell'), dark: t('theme.dark', 'Dunkel'), system: t('theme.system', 'System') }[th],
        }),
        suche: 'farbschema thema theme hell dunkel light dark system modus',
        icon: th === 'light' ? <Sun size={14} /> : th === 'dark' ? <Moon size={14} /> : <Monitor size={14} />,
        meta: theme === th ? t('palette.current', 'aktiv') : undefined,
        run: () => {
          onThemeChange(th)
          onClose()
        },
      })),
      {
        id: 'act:locale',
        gruppe: t('palette.group.actions', 'Aktionen'),
        label: locale === 'de' ? 'Switch to English' : 'Auf Deutsch umstellen',
        suche: 'sprache language english deutsch',
        icon: <Languages size={14} />,
        run: () => {
          setLocale(locale === 'de' ? 'en' : 'de')
          onClose()
        },
      },
    ]

    const szenarien: Eintrag[] = scenarios.map((s, i) => {
      const name = s.label.trim() || t('scenario.fallbackName', `Szenario ${i + 1}`, { n: String(i + 1) })
      return {
        id: `scenario:${s.id}`,
        gruppe: t('plan.scenarios', 'Szenarien'),
        label: name,
        suche: `szenario scenario ${name}`,
        icon: <span className="block h-2 w-2 rounded-[2px]" style={{ background: slotVar(s.colorSlot) }} />,
        run: () => {
          dispatch(actions.selectScenario(s.id))
          gehe('sparplan')
        },
      }
    })

    // Einstellungen aus dem Index des Kerns, beschriftet in der aktiven Sprache.
    const gesehen = new Set<string>()
    const einstellungen: Eintrag[] = buildSettingsIndex().flatMap((e: SettingsEntry) => {
      const stil = e.id === 'style' ? CHART_STYLES.find((s) => s.label === e.label) : undefined
      const regel = e.id === 'model:withdrawalRule' ? WITHDRAWAL_STRATEGIES.find((s) => s.label === e.label) : undefined
      const schluessel = e.id.replace(':', '.')
      const label = e.id.startsWith('param:')
        ? t(`param.${e.id.slice(6)}.label`, e.label)
        : e.id.startsWith('timeline:')
          ? t(`timeline.${e.id.slice(9)}.label`, e.label)
          : e.id.startsWith('series:')
            ? t(`series.${e.id.slice(7)}.label`, e.label)
            : stil
              ? t(`style.${stil.id}.label`, e.label)
              : regel
                ? t(`withdrawal.${regel.id}.label`, e.label)
                : t(`settings.index.${schluessel}.label`, e.label)
      const doppelt = `${e.id}|${label}`
      if (gesehen.has(doppelt)) return []
      gesehen.add(doppelt)
      const z = ziel(e.id)
      return [
        {
          id: `setting:${doppelt}`,
          gruppe: t('palette.group.settings', 'Einstellungen'),
          label,
          suche: [e.label, ...e.keywords, t(`settings.index.${schluessel}.keywords`, '')].join(' '),
          icon: <SlidersHorizontal size={14} />,
          meta:
            z.page === 'video'
              ? t('nav.video', 'Video')
              : t(`category.${e.category}.label`, SETTINGS_CATEGORIES.find((c) => c.id === e.category)?.label ?? e.category),
          run: () => gehe(z.page, z.setting),
        },
      ]
    })

    return [...bereiche, ...aktionen, ...szenarien, ...einstellungen]
  }, [t, locale, setLocale, dispatch, store, scenarios, theme, onThemeChange, onClose])

  const treffer = useMemo(() => {
    const q = normal(query.trim())
    if (q === '') {
      // Ohne Suche: Bereiche, Aktionen und die Einstellungen, an denen man am meisten dreht.
      const haeufig = new Set(['param:annualRate', 'param:monthlyContribution', 'param:initialCapital', 'timeline:accumulationYears'])
      return eintraege.filter((e) => !e.id.startsWith('setting:') || haeufig.has(e.id.slice(8).split('|')[0]))
    }
    const woerter = q.split(/\s+/)
    /*
     * Rang innerhalb der Gruppe: Treffer am Anfang der Beschriftung vor Treffer
     * am Wortanfang vor Treffer irgendwo darin vor reinen Schlagwort-Treffern;
     * bei Gleichstand die kürzere Beschriftung - sie trifft genauer.
     */
    const rang = (e: Eintrag) => {
      const label = normal(e.label)
      if (label.startsWith(q)) return 0
      if (label.split(/[\s·-]+/).some((wort) => wort.startsWith(woerter[0]))) return 1
      if (label.includes(woerter[0])) return 2
      return 3
    }
    const gruppen = [...new Set(eintraege.map((e) => e.gruppe))]
    return eintraege
      .filter((e) => {
        const heu = normal(`${e.label} ${e.suche} ${e.meta ?? ''}`)
        return woerter.every((w) => heu.includes(w))
      })
      .map((e) => ({ e, r: rang(e), g: gruppen.indexOf(e.gruppe) }))
      .sort((a, b) => a.g - b.g || a.r - b.r || a.e.label.length - b.e.label.length)
      .map(({ e }) => e)
  }, [eintraege, query])

  const index = Math.min(aktiv, Math.max(0, treffer.length - 1))
  const ausfuehren = (e: Eintrag | undefined) => e?.run()

  let letzteGruppe = ''
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      {...backdrop}
      aria-label={t('palette.open', 'Suchen und Befehle')}
      className="palette"
    >
      {open ? (
        <>
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--grid)] px-3">
            <Search size={15} aria-hidden className="shrink-0 text-[var(--text-muted)]" />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={treffer[index] ? `${listId}-${index}` : undefined}
              aria-label={t('palette.open', 'Suchen und Befehle')}
              placeholder={t('palette.placeholder', 'Einstellung oder Befehl …')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setAktiv(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setAktiv((index + 1) % Math.max(1, treffer.length))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setAktiv((index - 1 + treffer.length) % Math.max(1, treffer.length))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  ausfuehren(treffer[index])
                }
              }}
              className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
            <kbd className="shrink-0 rounded border border-[var(--hairline)] px-1 text-[10px] text-[var(--text-muted)]">Esc</kbd>
          </div>
          <ul id={listId} role="listbox" aria-label={t('palette.results', 'Treffer')} className="thin-scroll min-h-0 flex-1 overflow-y-auto p-1">
            {treffer.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                {t('settings.empty', 'Nichts gefunden für „{query}“.', { query })}
              </li>
            ) : (
              treffer.map((e, i) => {
                const kopf = e.gruppe !== letzteGruppe
                letzteGruppe = e.gruppe
                return (
                  <li key={e.id} role="presentation">
                    {kopf ? (
                      <div role="presentation" className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {e.gruppe}
                      </div>
                    ) : null}
                    <div
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === index}
                      onPointerMove={() => setAktiv(i)}
                      onClick={() => ausfuehren(e)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-xs',
                        i === index ? 'bg-[var(--grid)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
                      )}
                    >
                      <span aria-hidden className="flex w-4 shrink-0 justify-center text-[var(--text-muted)]">
                        {e.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{e.label}</span>
                      {e.meta ? <span className="shrink-0 text-[10px] text-[var(--text-muted)]">{e.meta}</span> : null}
                      {i === index ? <CornerDownLeft size={12} aria-hidden className="shrink-0 text-[var(--text-muted)]" /> : null}
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </>
      ) : null}
    </dialog>
  )
}
