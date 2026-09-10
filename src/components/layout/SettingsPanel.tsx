import { Search, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { selectActiveParamIds, selectActiveScenario, selectProjection } from '../../core/derive'
import {
  SETTINGS_CATEGORIES,
  SETTINGS_SCOPE_META,
  buildSettingsIndex,
  cardId,
  compactIds,
  matchSettings,
  matchingCards,
  type SettingsCardId,
  type SettingsCategoryId,
} from '../../core/settings'
import { slotVar } from '../../core/palette'
import { actions } from '../../core/state'
import { cn } from '../../lib/cn'
import { useT } from '../../react/localeContext'
import { useDispatch, useSelector } from '../../react/useSelector'
import {
  ChartStyleControl,
  CompoundingControl,
  InflationAmountsControl,
  TimeAxisControls,
  TimelineControls,
  TimingControl,
  WithdrawalPhaseToggle,
  WithdrawalRuleControl,
} from '../ModelSettings'
import { MarketPanel } from '../MarketPanel'
import { ParameterPanel } from '../ParameterPanel'
import { ScenarioList } from '../ScenarioList'
import { SeriesPanel } from '../SeriesPanel'
import { Card } from '../ui/Card'
import { SegmentedControl } from '../ui/SegmentedControl'

/**
 * Der komplette Einstellungsbereich - genau einmal definiert.
 *
 * Wird je nach Viewport in einen anderen Container gehängt (Seitenspalte auf
 * dem Desktop, Bottom-Sheet auf Mobil). Der Inhalt weiß davon nichts.
 *
 * Gegliedert in Kategorien mit Suche darüber. Der Suchindex kommt aus den
 * Registries (siehe core/settings), nicht aus einer Handpflege - eine neue
 * Serie oder ein neuer Parameter ist damit sofort auffindbar.
 */
export interface SettingsPanelProps {
  /**
   * „schmal" ist die Seitenspalte und das Sheet, „breit" der Einstellungsdialog.
   *
   * Nur dort liegen die beiden Bereiche wirklich nebeneinander - in 320 px
   * Breite wären zwei Spalten je 150 px, und darin steht kein Regler mehr
   * lesbar.
   */
  readonly layout?: 'schmal' | 'breit'
}

export function SettingsPanel({ layout = 'schmal' }: SettingsPanelProps = {}) {
  const dispatch = useDispatch()
  const scenarios = useSelector((s) => s.scenarios)
  const activeScenarioId = useSelector((s) => s.activeScenarioId)
  const enabledSeriesIds = useSelector((s) => s.enabledSeriesIds)
  const model = useSelector((s) => s.model)
  const chartStyleId = useSelector((s) => s.chartStyleId)
  const activeScenario = useSelector(selectActiveScenario)
  const activeParamIds = useSelector(selectActiveParamIds)
  const capacity = useSelector(selectProjection).capacity

  const t = useT()
  const [query, setQuery] = useState('')
  // Aus dem Store, nicht aus lokalem State: das Bottom-Sheet montiert dieses
  // Panel bei jedem Öffnen neu und hätte den Zustand sonst jedes Mal vergessen.
  const zu = useSelector((s) => s.collapsedCards)
  const ansicht = useSelector((s) => s.settingsView)

  const index = useMemo(() => buildSettingsIndex(), [])
  const suche = useMemo(() => matchSettings(index, query), [index, query])
  /*
   * Die kompakte Ansicht laeuft durch dieselbe Filterung wie die Suche.
   *
   * Sie liefert eine Menge erlaubter IDs statt `null` - damit brauchen die
   * Anzeige-Komponenten keinen zweiten Weg zu kennen. Bei aktiver Suche
   * gewinnt die Suche: wer sucht, will finden, nicht gefiltert werden.
   */
  const matches = useMemo(
    () => (suche !== null ? suche : ansicht === 'kompakt' ? compactIds(index) : null),
    [suche, ansicht, index],
  )
  const sichtbareKarten = useMemo(() => matchingCards(index, matches), [index, matches])

  const setModel = (next: typeof model) => dispatch(actions.setModel(next))

  const regler = (category: SettingsCategoryId, emptyHint?: string) => (
    <ParameterPanel
      category={category}
      params={activeScenario.params}
      activeParamIds={activeParamIds}
      matches={matches}
      emptyHint={emptyHint}
      onChange={(id, value) => dispatch(actions.setParam(activeScenario.id, id, value))}
    />
  )

  const mitEntnahme = model.withdrawalYears > 0

  /*
   * Der Inhalt je Karte, aufgeteilt nach Bereich.
   *
   * Was hier nebeneinander steht, gehoert auch zusammen: die Sparrate liegt im
   * Szenario, die Ansparphase darueber. Frueher standen beide in derselben
   * Karte, und der Unterschied war nur einem Hinweissatz zu entnehmen.
   */
  const inhalte: Partial<Record<SettingsCardId, ReactNode>> = {
    'scenario:kapital': regler('kapital'),
    'scenario:einzahlung': regler('einzahlung'),
    /*
     * Eine Karte, die durch einen Schalter leer geworden ist, sagt das.
     *
     * Ohne den Satz stünde hier eine Überschrift über nichts - der haeufigste
     * Weg, jemanden glauben zu lassen, die Anwendung sei kaputt.
     */
    'scenario:auszahlung': regler(
      'auszahlung',
      mitEntnahme
        ? t(
            'settings.empty.auszahlung.rule',
            'Die gewählte Entnahmeregel liest den anderen Wert – umschalten unter „Für alle Szenarien“.',
          )
        : t(
            'settings.empty.auszahlung',
            'Ohne Entnahmephase gibt es hier nichts einzustellen. Der Schalter dafür steht unter „Für alle Szenarien“.',
          ),
    ),
    'scenario:annahmen': regler(
      'annahmen',
      t(
        'settings.empty.annahmen',
        'Diese Werte liest gerade keine eingeschaltete Kurve – unter „Kurven“ etwa Kaufkraft oder Tagesgeld dazunehmen.',
      ),
    ),

    'global:einzahlung': (
      <div className="space-y-5">
        <TimelineControls
          category="einzahlung"
          value={model}
          onChange={setModel}
          matches={matches}
        />
        <TimingControl value={model} onChange={setModel} matches={matches} />
      </div>
    ),
    'global:auszahlung': (
      <div className="space-y-5">
        <WithdrawalPhaseToggle value={model} onChange={setModel} matches={matches} />
        {/* Regel und Dauer haben ohne Entnahmephase keine Bedeutung - sie
            stehen erst da, wenn der Schalter an ist. */}
        {mitEntnahme ? (
          <>
            {matches === null || matches.has('model:withdrawalRule') ? (
              <WithdrawalRuleControl value={model} onChange={setModel} />
            ) : null}
            <TimelineControls
              category="auszahlung"
              value={model}
              onChange={setModel}
              matches={matches}
            />
          </>
        ) : null}
      </div>
    ),
    'global:annahmen': (
      <div className="space-y-5">
        <CompoundingControl value={model} onChange={setModel} matches={matches} />
        <InflationAmountsControl value={model} onChange={setModel} matches={matches} />
      </div>
    ),
    'global:zeit': <TimeAxisControls value={model} onChange={setModel} matches={matches} />,
    'global:wertpapiere': <MarketPanel matches={matches} />,
    'global:kurven': (
      <div className="space-y-5">
        <SeriesPanel
          enabledSeriesIds={enabledSeriesIds}
          onToggle={(id) => dispatch(actions.toggleSeries(id))}
          capacity={capacity}
          matches={matches}
        />
        <ChartStyleControl
          value={chartStyleId}
          onChange={(id) => dispatch(actions.setChartStyle(id))}
          matches={matches}
        />
      </div>
    ),
  }

  /*
   * Die Szenarienliste steht ueber beiden Bereichen statt in einem.
   *
   * Sie ist keine Einstellung, sondern der Umschalter, auf den sich das Wort
   * "dieses" im Bereich darunter bezieht - unter "Fuer alle Szenarien" waere
   * sie richtig einsortiert und trotzdem am falschen Platz.
   */
  const szenarienOben =
    sichtbareKarten.has('global:szenarien') ? (
      <ScenarioList scenarios={scenarios} activeScenarioId={activeScenarioId} />
    ) : null

  const kartenIn = (scope: 'scenario' | 'global') =>
    SETTINGS_CATEGORIES.filter((k) => {
      if (k.id === 'szenarien') return false
      const id = cardId(scope, k.id)
      return sichtbareKarten.has(id) && inhalte[id] !== undefined
    })

  const leer = sichtbareKarten.size === 0

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={14}
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('settings.search', 'Einstellung suchen …')}
          aria-label={t('settings.search', 'Einstellung suchen …')}
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] py-2 pl-8 pr-8 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--chart-1)] focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('settings.clearSearch', 'Suche leeren')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X size={13} aria-hidden />
          </button>
        ) : null}
      </div>

      {/*
        Kompakt zeigt die Karten, an denen man wirklich dreht. Bei aktiver Suche
        hat der Schalter keine Wirkung und verschwindet deshalb - ein Regler,
        der nichts tut, ist schlimmer als keiner.
      */}
      {suche === null ? (
        <SegmentedControl
          label={t('settings.view', 'Ansicht')}
          value={ansicht}
          onChange={(view) => dispatch(actions.setSettingsView(view))}
          options={[
            {
              value: 'kompakt' as const,
              label: t('settings.view.kompakt', 'Kompakt'),
              hint: 'Nur die Einstellungen, die man häufig anfasst.',
            },
            {
              value: 'alles' as const,
              label: t('settings.view.alles', 'Alles'),
              hint: 'Zusätzlich Zeit, Wertpapiere und Rechenannahmen.',
            },
          ]}
        />
      ) : null}

      {leer ? (
        <p className="px-1 py-6 text-center text-xs text-[var(--text-muted)]">
          {t('settings.empty', `Nichts gefunden für „${query}“.`, { query })}
        </p>
      ) : null}

      {szenarienOben ? <Card>{szenarienOben}</Card> : null}

      <div className={cn(layout === 'breit' ? 'grid gap-4 lg:grid-cols-2 lg:items-start' : '')}>
      {SETTINGS_SCOPE_META.map((bereich) => {
        const karten = kartenIn(bereich.id)
        if (karten.length === 0) return null

        return (
          <section key={bereich.id} data-scope={bereich.id} className="space-y-2 pt-1">
            <div className="flex items-baseline gap-2 px-1">
              {/* Der Farbpunkt des aktiven Szenarios macht "dieses" konkret -
                  er ist derselbe wie in der Liste darueber und an der Kurve. */}
              {bereich.id === 'scenario' ? (
                <span
                  aria-hidden
                  className="size-2 shrink-0 translate-y-[-1px] rounded-full"
                  style={{ background: slotVar(activeScenario.colorSlot) }}
                />
              ) : null}
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                {bereich.id === 'scenario'
                  ? t('scope.scenario.labelNamed', `Nur „${activeScenario.label}“`, {
                      name: activeScenario.label,
                    })
                  : t(`scope.${bereich.id}.label`, bereich.label)}
              </h3>
            </div>
            <p className="px-1 text-[11px] leading-snug text-[var(--text-muted)]">
              {t(`scope.${bereich.id}.hint`, bereich.hint)}
            </p>

            {karten.map((kategorie) => {
              const id = cardId(bereich.id, kategorie.id)
              // Bei aktiver Suche immer offen - sonst muesste man den Treffer
              // erst aufklappen.
              const offen = suche !== null || !zu.includes(id)

              return (
                <Card key={id} padded={false}>
                  <button
                    type="button"
                    onClick={() => dispatch(actions.toggleSettingsCard(id))}
                    aria-expanded={offen}
                    disabled={suche !== null}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left disabled:cursor-default"
                  >
                    <span>
                      <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {t(`category.${kategorie.id}.label`, kategorie.label)}
                      </span>
                      {!offen ? (
                        <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">
                          {t(`category.${kategorie.id}.hint`, kategorie.hint)}
                        </span>
                      ) : null}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        'shrink-0 text-[var(--text-muted)] transition-transform',
                        offen ? 'rotate-90' : '',
                      )}
                    >
                      ›
                    </span>
                  </button>
                  {offen ? <div className="px-4 pb-4">{inhalte[id]}</div> : null}
                </Card>
              )
            })}
          </section>
        )
      })}
      </div>
    </div>
  )
}
