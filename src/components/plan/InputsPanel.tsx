import type { ReactNode } from 'react'
import { selectActiveParamIds, selectActiveScenario, selectProjection } from '../../core/derive'
import { PARAMETERS, type ParamDefinition, type ParamId } from '../../core/domain/parameters'
import { slotVar } from '../../core/palette'
import { actions } from '../../core/state'
import { cn } from '../../lib/cn'
import { formatPercent } from '../../lib/format'
import { useT } from '../../react/localeContext'
import { useDispatch, useSelector } from '../../react/useSelector'
import { useDepotRate } from '../depot/useDepotRate'
import { MarketPanel } from '../MarketPanel'
import {
  CompoundingControl,
  InflationAmountsControl,
  TimeAxisControls,
  TimelineControls,
  TimingControl,
  WithdrawalPhaseToggle,
  WithdrawalRuleControl,
} from '../ModelSettings'
import { SeriesPanel } from '../SeriesPanel'
import { SliderField } from '../ui/SliderField'

/** Abschnitt „Echte Kursverläufe" - die Beobachtungsliste springt mit ihrem Plus dorthin. */
export const ABSCHNITT_WERTPAPIERE = 'plan-wertpapiere'

type Geltung = 'scenario' | 'global' | 'mixed'

/**
 * Ein Abschnitt der Eingaben: Überschrift, die beim Scrollen stehen bleibt,
 * und rechts daneben, wofür die Werte gelten. Nichts ist zugeklappt - wer eine
 * Einstellung sucht, scrollt oder fragt die Befehlspalette, statt zu raten,
 * hinter welchem Pfeil sie steckt.
 */
function Abschnitt({
  id,
  title,
  geltung,
  children,
}: {
  readonly id?: string
  readonly title: string
  readonly geltung: Geltung
  readonly children: ReactNode
}) {
  const t = useT()
  const szenario = useSelector(selectActiveScenario)
  return (
    <section id={id} aria-label={title} className="border-b border-[var(--grid)]">
      <div className="sticky top-0 z-10 flex h-8 items-center justify-between gap-2 border-b border-[var(--grid)] bg-[var(--surface-1)] px-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{title}</h3>
        {geltung === 'mixed' ? null : (
          <span
            className="flex min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] ring-1 ring-inset ring-[var(--grid)]"
            title={
              geltung === 'scenario'
                ? t('scope.scenario.hint', 'Im Szenario gespeichert. Ein zweites Szenario kann hier andere Werte haben.')
                : t('scope.global.hint', 'Gilt für jede Kurve im Diagramm.')
            }
          >
            {geltung === 'scenario' ? (
              <>
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-[2px]" style={{ background: slotVar(szenario.colorSlot) }} />
                <span className="truncate">{szenario.label || t('scope.scenario.label', 'Nur dieses Szenario')}</span>
              </>
            ) : (
              t('scope.global.label', 'Alle Szenarien')
            )}
          </span>
        )}
      </div>
      <div className="space-y-3 px-3 py-3">{children}</div>
    </section>
  )
}

/** Hülle, an der die Befehlspalette eine Einstellung wiederfindet. */
const Setting = ({ id, children }: { readonly id: string; readonly children: ReactNode }) => (
  <div data-setting={id}>{children}</div>
)

const VORGABEN = [3, 5, 7, 9]

/** Schnellwahl für die Rendite - runde Werte zum Vergleichen, dazu die eigene Depot-Historie. */
function RenditeVorgaben({ value, onPick }: { readonly value: number; readonly onPick: (v: number) => void }) {
  const t = useT()
  const depot = useDepotRate()
  const { min, max } = PARAMETERS.annualRate
  const begrenzt = depot === null ? null : Math.min(max, Math.max(min, depot))
  const chip = (aktiv: boolean) =>
    cn(
      'h-6 rounded px-2 text-[11px] font-medium transition-colors',
      aktiv
        ? 'bg-[color-mix(in_srgb,var(--accent-fill)_10%,transparent)] text-[var(--accent-text)]'
        : 'text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--grid)] hover:text-[var(--text-primary)]',
    )
  return (
    <div role="group" aria-label={t('plan.ratePresets', 'Rendite-Vorgaben')} className="-mt-1 flex flex-wrap gap-1">
      {VORGABEN.map((v) => (
        <button key={v} type="button" aria-pressed={value === v} className={chip(value === v)} onClick={() => onPick(v)}>
          {formatPercent(v)}
        </button>
      ))}
      {depot !== null && begrenzt !== null ? (
        <button
          type="button"
          aria-pressed={value === begrenzt}
          className={chip(value === begrenzt)}
          onClick={() => onPick(begrenzt)}
          title={t('plan.rateDepotHint', 'Historische Rendite deines Depots – keine Prognose.')}
        >
          {t('plan.rateDepot', 'Wie mein Depot: {rate}', { rate: formatPercent(depot) })}
        </button>
      ) : null}
    </div>
  )
}

/**
 * Alle Eingaben des Plans in einer Spalte.
 *
 * Oben, woran man am häufigsten dreht (Rendite, Kapital, Sparrate, Laufzeit),
 * darunter Entnahme, Annahmen, Kurven, Wertpapiere und Zeitachse. Jeder Wert
 * ist tippbar, mit Pfeiltasten schrittweise änderbar und per Regler zu
 * erkunden.
 */
export function InputsPanel() {
  const t = useT()
  const dispatch = useDispatch()
  const szenario = useSelector(selectActiveScenario)
  const model = useSelector((s) => s.model)
  const enabledSeriesIds = useSelector((s) => s.enabledSeriesIds)
  const aktiveParameter = useSelector(selectActiveParamIds)
  const capacity = useSelector(selectProjection).capacity
  const setModel = (next: typeof model) => dispatch(actions.setModel(next))
  const mitEntnahme = model.withdrawalYears > 0

  const param = (id: ParamId) => {
    const def: ParamDefinition = PARAMETERS[id]
    return (
      <Setting key={id} id={`param:${id}`}>
        <SliderField
          definition={{
            ...def,
            label: t(`param.${id}.label`, def.label),
            hint: def.hint ? t(`param.${id}.hint`, def.hint) : undefined,
          }}
          value={szenario.params[id]}
          onChange={(value) => dispatch(actions.setParam(szenario.id, id, value))}
        />
      </Setting>
    )
  }

  return (
    <div>
      <Abschnitt title={t('inputs.plan', 'Sparplan')} geltung="scenario">
        {param('annualRate')}
        <RenditeVorgaben
          value={szenario.params.annualRate}
          onPick={(v) => dispatch(actions.setParam(szenario.id, 'annualRate', v))}
        />
        {param('initialCapital')}
        {param('monthlyContribution')}
        {param('contributionGrowth')}
      </Abschnitt>

      <Abschnitt title={t('inputs.duration', 'Laufzeit')} geltung="global">
        <Setting id="timeline:accumulationYears">
          <TimelineControls category="einzahlung" value={model} onChange={setModel} note={false} />
        </Setting>
        <Setting id="model:timing">
          <TimingControl value={model} onChange={setModel} />
        </Setting>
      </Abschnitt>

      <Abschnitt title={t('plan.section.payout', 'Auszahlung')} geltung="mixed">
        <Setting id="timeline:withdrawalYears">
          <WithdrawalPhaseToggle value={model} onChange={setModel} />
        </Setting>
        {mitEntnahme ? (
          <>
            <Setting id="model:withdrawalRule">
              <WithdrawalRuleControl value={model} onChange={setModel} />
            </Setting>
            <TimelineControls category="auszahlung" value={model} onChange={setModel} note={false} />
            {(['monthlyWithdrawal', 'withdrawalRate'] as const).filter((id) => aktiveParameter.has(id)).map(param)}
          </>
        ) : (
          <p className="text-[11px] leading-snug text-[var(--text-muted)]">
            {t('plan.empty.payout', 'Erst mit Entnahmephase gibt es hier etwas einzustellen.')}
          </p>
        )}
      </Abschnitt>

      <Abschnitt title={t('plan.section.assumptions', 'Annahmen')} geltung="mixed">
        {/* Die Inflation wirkt immer - mindestens auf „Kaufkraft heute" im Kopf. */}
        {param('inflationRate')}
        <Setting id="model:amountsInflationAdjusted">
          <InflationAmountsControl value={model} onChange={setModel} />
        </Setting>
        {aktiveParameter.has('savingsRate') ? param('savingsRate') : null}
        <Setting id="model:compounding">
          <CompoundingControl value={model} onChange={setModel} />
        </Setting>
      </Abschnitt>

      <Abschnitt title={t('inputs.curves', 'Kurven')} geltung="global">
        <Setting id="series">
          <SeriesPanel
            enabledSeriesIds={enabledSeriesIds}
            onToggle={(id) => dispatch(actions.toggleSeries(id))}
            capacity={capacity}
          />
        </Setting>
      </Abschnitt>

      <Abschnitt id={ABSCHNITT_WERTPAPIERE} title={t('plan.section.markets', 'Echte Kursverläufe')} geltung="global">
        <Setting id="market">
          <MarketPanel />
        </Setting>
      </Abschnitt>

      <Abschnitt title={t('plan.section.time', 'Zeitachse')} geltung="global">
        <Setting id="model:timeAxis">
          <TimeAxisControls value={model} onChange={setModel} />
        </Setting>
      </Abschnitt>
    </div>
  )
}
