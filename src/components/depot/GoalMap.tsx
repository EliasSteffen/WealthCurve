import { X } from 'lucide-react'
import { Suspense, lazy, useId, useMemo, useState } from 'react'
import { dimView, goalState, type GoalCheck, type GoalTarget } from '../../core/depot/goals'
import { COUNTRIES, type Continent, type LookThrough } from '../../core/depot/lookthrough'
import { currentFormatterLocale } from '../../lib/format'
import { useT } from '../../react/localeContext'
import { SegmentedControl } from '../ui/SegmentedControl'
import { pct, shareLabel } from './depotFormat'
import { GrenzFeld } from './GrenzFeld'
import type { GoalState, MapLevel } from './WorldMapSvg'

/** Die Umrisse kommen erst, wenn die Karte zu sehen ist. */
const WorldMapSvg = lazy(() => import('./WorldMapSvg'))

const KONTINENTE: readonly Continent[] = ['northAmerica', 'europe', 'asia', 'oceania', 'southAmerica', 'africa']

/**
 * Füllung nach heutigem Anteil: je mehr, desto kräftiger. Die Wurzel hebt
 * kleine Anteile an - sonst sähe man neben 70 % USA nichts anderes.
 */
function fuellung(anteil: number, max: number): string {
  if (!(anteil > 0) || !(max > 0)) return 'var(--grid)'
  const staerke = Math.round(18 + 82 * Math.sqrt(Math.min(1, anteil / max)))
  return `color-mix(in srgb, var(--chart-1) ${staerke}%, var(--surface-1))`
}

/** Zielstatus je Schlüssel; ein verletztes Ziel schlägt ein erfülltes. */
function stände(checks: readonly GoalCheck[], ebene: MapLevel): Map<string, GoalState> {
  const out = new Map<string, GoalState>()
  for (const c of checks) {
    if (c.target.dim !== ebene || c.status === 'noData') continue
    const stand: GoalState = c.status === 'ok' ? 'ok' : 'off'
    if (out.get(c.key) !== 'off') out.set(c.key, stand)
  }
  return out
}

/**
 * Ziele für Kontinente und Länder auf der Weltkarte festlegen.
 *
 * Region antippen, Bandbreite eintragen - die Füllung zeigt den heutigen
 * Anteil am Aktienteil, der Rand, ob ein Ziel besteht und erfüllt ist. Für die
 * Tastatur steht dieselbe Auswahl als Liste unter der Karte; die Umrisse selbst
 * sind kein Tab-Halt, sonst wären es über 170.
 */
export function GoalMap({
  look,
  goals,
  checks,
  onSet,
  onRemove,
}: {
  readonly look: LookThrough
  readonly goals: readonly GoalTarget[]
  readonly checks: readonly GoalCheck[]
  readonly onSet: (target: GoalTarget) => void
  readonly onRemove: (target: GoalTarget) => void
}) {
  const t = useT()
  const id = useId()
  const [ebene, setEbene] = useState<MapLevel>('continent')
  const [gewaehlt, setGewaehlt] = useState<string | null>(null)
  const [schwebt, setSchwebt] = useState<string | null>(null)

  const anteile = useMemo(() => dimView(goalState(look), ebene).shares, [look, ebene])
  const max = Math.max(0, ...anteile.values())
  const stand = useMemo(() => stände(checks, ebene), [checks, ebene])
  const ziel = (key: string | null) => (key ? goals.find((g) => g.dim === ebene && g.key === key) : undefined)

  const beschriftung = (key: string) => {
    const zielHier = ziel(key)
    const anteil = anteile.get(key) ?? 0
    return [
      shareLabel(ebene, key, t),
      anteil > 0 ? t('depot.map.today', 'heute {share}', { share: pct(anteil) }) : t('depot.map.none', 'nicht im Depot'),
      zielHier
        ? t('depot.map.goal', 'Ziel {range}', {
            range: `${zielHier.min !== null ? pct(zielHier.min, 0) : pct(0, 0)} – ${zielHier.max !== null ? pct(zielHier.max, 0) : pct(1, 0)}`,
          })
        : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  // Die Liste kennt die Länder der Durchschau; ein anderes, auf der Karte gewähltes kommt dazu.
  const optionen = useMemo(() => {
    if (ebene === 'continent') return KONTINENTE.map((k) => ({ key: k, label: shareLabel('continent', k, t) }))
    const codes = new Set([
      ...Object.values(COUNTRIES).map((c) => c.code),
      ...goals.filter((g) => g.dim === 'country' && g.key !== '*').map((g) => g.key),
      ...(gewaehlt ? [gewaehlt] : []),
    ])
    return [...codes]
      .map((code) => ({ key: code, label: shareLabel('country', code, t) }))
      .sort((a, b) => a.label.localeCompare(b.label, currentFormatterLocale()))
  }, [ebene, goals, gewaehlt, t])

  const aktiv = gewaehlt && optionen.some((o) => o.key === gewaehlt) ? gewaehlt : null
  const aktivZiel = ziel(aktiv)
  const aktivName = aktiv ? shareLabel(ebene, aktiv, t) : ''
  const setze = (min: number | null, hoechstens: number | null) => {
    if (!aktiv) return
    if (min === null && hoechstens === null) {
      if (aktivZiel) onRemove(aktivZiel)
      return
    }
    onSet({ dim: ebene, key: aktiv, min, max: hoechstens })
  }

  const wechsle = (neu: MapLevel) => {
    setEbene(neu)
    setGewaehlt(null)
    setSchwebt(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="w-56">
          <SegmentedControl<MapLevel>
            label={t('depot.map.level', 'Ziele auf der Karte')}
            value={ebene}
            onChange={wechsle}
            options={[
              { value: 'continent', label: t('depot.bd.continents', 'Kontinente') },
              { value: 'country', label: t('depot.bd.countries', 'Länder') },
            ]}
          />
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          {schwebt
            ? beschriftung(schwebt)
            : ebene === 'continent'
              ? t('depot.map.hintContinent', 'Kontinent antippen und Bandbreite eintragen.')
              : t('depot.map.hintCountry', 'Land antippen und Bandbreite eintragen.')}
        </p>
      </div>

      {/* Auf dem Handy breiter als der Bildschirm: kleine Länder bleiben antippbar. */}
      <div className="relative overflow-x-auto">
        <div className="mx-auto min-w-[34rem] max-w-[52rem]">
          <Suspense
            fallback={
              <div className="aspect-[2/1] w-full animate-pulse rounded-lg bg-[var(--grid)]" aria-hidden />
            }
          >
            <WorldMapSvg
              level={ebene}
              fill={(key) => fuellung(anteile.get(key) ?? 0, max)}
              goal={(key) => stand.get(key)}
              label={beschriftung}
              selected={aktiv}
              hovered={schwebt}
              onPick={setGewaehlt}
              onHover={setSchwebt}
              ariaLabel={t('depot.map.label', 'Weltkarte: heutiger Anteil und Ziele je Region')}
            />
          </Suspense>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-16 rounded-full"
            style={{
              background: 'linear-gradient(to right, color-mix(in srgb, var(--chart-1) 18%, var(--surface-1)), var(--chart-1))',
            }}
          />
          {t('depot.map.scale', 'Anteil heute (0 bis {max})', { max: pct(max, 0) })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[3px] ring-2 ring-inset ring-[var(--chart-3)]" />
          {t('depot.map.ok', 'Ziel erfüllt')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[3px] ring-2 ring-inset ring-[var(--chart-2)]" />
          {t('depot.map.off', 'Ziel verfehlt')}
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--hairline)] p-3">
        <label className="text-xs text-[var(--text-secondary)]" htmlFor={`${id}-region`}>
          <span className="mb-1 block">
            {ebene === 'continent' ? t('depot.map.pickContinent', 'Kontinent') : t('depot.map.pickCountry', 'Land')}
          </span>
          <select
            id={`${id}-region`}
            value={aktiv ?? ''}
            onChange={(e) => setGewaehlt(e.target.value || null)}
            className="max-w-[14rem] rounded-md border border-[var(--hairline)] bg-[var(--surface-1)] px-2 py-1 text-sm text-[var(--text-primary)] focus:border-[var(--chart-1)] focus:outline-none"
          >
            <option value="">{t('depot.map.pick', 'Auf der Karte wählen …')}</option>
            {optionen.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {aktiv ? (
          <>
            <p className="min-w-[8rem] flex-1 pb-1 text-sm text-[var(--text-primary)]">
              <span className="font-medium">{aktivName}</span>
              <span className="text-[var(--text-secondary)]">
                {' · '}
                {(anteile.get(aktiv) ?? 0) > 0
                  ? t('depot.map.today', 'heute {share}', { share: pct(anteile.get(aktiv) ?? 0) })
                  : t('depot.map.none', 'nicht im Depot')}
              </span>
            </p>
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              {t('depot.map.range', 'Ziel')}
              <GrenzFeld
                value={aktivZiel?.min ?? null}
                label={t('depot.goals.minOf', 'Mindestens, {name}', { name: aktivName })}
                onCommit={(min) => setze(min, aktivZiel?.max ?? null)}
              />
              <span aria-hidden>–</span>
              <GrenzFeld
                value={aktivZiel?.max ?? null}
                label={t('depot.goals.maxOf', 'Höchstens, {name}', { name: aktivName })}
                onCommit={(hoechstens) => setze(aktivZiel?.min ?? null, hoechstens)}
              />
              {aktivZiel ? (
                <button
                  type="button"
                  onClick={() => onRemove(aktivZiel)}
                  aria-label={t('depot.goals.remove', 'Ziel {name} entfernen', { name: aktivName })}
                  className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--grid)] hover:text-[var(--text-primary)]"
                >
                  <X size={14} aria-hidden />
                </button>
              ) : null}
            </span>
          </>
        ) : (
          <p className="pb-1 text-xs text-[var(--text-muted)]">
            {t('depot.map.empty', 'Noch nichts gewählt – Region antippen oder aus der Liste wählen.')}
          </p>
        )}
      </div>
    </div>
  )
}
