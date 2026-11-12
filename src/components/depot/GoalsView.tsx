import { CheckCircle2, CircleAlert, Plus, X } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import {
  EACH_KEY,
  GOAL_DIMS,
  GOAL_KEYS,
  GOAL_PRESET_IDS,
  applyPreset,
  goalAdvice,
  type BlockId,
  type GoalCheck,
  type GoalDim,
  type GoalPresetId,
  type GoalTarget,
} from '../../core/depot/goals'
import { COUNTRIES, type LookThrough } from '../../core/depot/lookthrough'
import { actions } from '../../core/state'
import type { Translate } from '../../i18n'
import { cn } from '../../lib/cn'
import { currentFormatterLocale, formatEur } from '../../lib/format'
import { useT } from '../../react/localeContext'
import { useDispatch } from '../../react/useSelector'
import { pct, shareLabel } from './depotFormat'

const KNOPF =
  'rounded-lg border border-[var(--hairline)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--grid)] disabled:opacity-40'
const EINGABE =
  'rounded-md border border-[var(--hairline)] bg-[var(--surface-1)] px-2 py-1 text-sm text-[var(--text-primary)] focus:border-[var(--chart-1)] focus:outline-none'

function dimLabel(dim: GoalDim, t: Translate): string {
  switch (dim) {
    case 'asset':
      return t('depot.bd.assets', 'Anlageklassen')
    case 'market':
      return t('depot.bd.markets', 'Märkte (MSCI)')
    case 'continent':
      return t('depot.bd.continents', 'Kontinente')
    case 'country':
      return t('depot.bd.countries', 'Länder')
    case 'sector':
      return t('depot.bd.sectors', 'Branchen (GICS)')
    case 'size':
      return t('depot.bd.sizes', 'Unternehmensgröße')
  }
}

function keyLabel(dim: GoalDim, key: string, t: Translate): string {
  if (key === EACH_KEY) {
    return dim === 'country'
      ? t('depot.goals.eachCountry', 'Jedes einzelne Land')
      : t('depot.goals.eachSector', 'Jede einzelne Branche')
  }
  if (dim === 'asset' && key === 'cash') return t('depot.asset.cash', 'Tagesgeld & Geldmarkt')
  return shareLabel(dim, key, t)
}

function presetText(id: GoalPresetId, t: Translate): { title: string; text: string } {
  switch (id) {
    case 'marketWeight':
      return {
        title: t('depot.goals.preset.marketWeight', 'Welt nach Börsenwert'),
        text: t('depot.goals.preset.marketWeightText', 'Wie ein ACWI: rund 89 % Industrie-, 11 % Schwellenländer'),
      }
    case 'em30':
      return {
        title: t('depot.goals.preset.em30', '70/30'),
        text: t('depot.goals.preset.em30Text', '70 % Industrie-, 30 % Schwellenländer'),
      }
    case 'gdp':
      return {
        title: t('depot.goals.preset.gdp', 'Nach Wirtschaftskraft'),
        text: t('depot.goals.preset.gdpText', 'Regionen grob nach Anteil am Welt-BIP'),
      }
    case 'caps':
      return {
        title: t('depot.goals.preset.caps', 'Klumpen begrenzen'),
        text: t('depot.goals.preset.capsText', 'Kein Land über 50 %, keine Branche über 30 %'),
      }
    case 'equityBond':
      return {
        title: t('depot.goals.preset.equityBond', '80/20'),
        text: t('depot.goals.preset.equityBondText', '80 % Aktien, 20 % Anleihen'),
      }
    case 'smallCaps':
      return {
        title: t('depot.goals.preset.smallCaps', 'Mit Nebenwerten'),
        text: t('depot.goals.preset.smallCapsText', '8–15 % kleine Unternehmen'),
      }
  }
}

/** Baustein als Produktgattung, mit dem Index als Beispiel - keine Fondsempfehlung. */
function blockText(id: BlockId, index: string, t: Translate): { title: string; example: string | null } {
  const beispiel = t('depot.block.example', 'z. B. auf {index}', { index })
  if (id.startsWith('sector:')) {
    return {
      title: t('depot.block.sector', 'Branchen-ETF {sector}', { sector: shareLabel('sector', id.slice(7), t) }),
      example: beispiel,
    }
  }
  if (id.startsWith('country:')) {
    return {
      title: t('depot.block.country', 'Länder-ETF {country}', { country: shareLabel('country', id.slice(8), t) }),
      example: beispiel,
    }
  }
  switch (id) {
    case 'world':
      return { title: t('depot.block.world', 'Welt-ETF (Industrieländer)'), example: beispiel }
    case 'em':
      return { title: t('depot.block.em', 'Schwellenländer-ETF'), example: beispiel }
    case 'europe':
      return { title: t('depot.block.europe', 'Europa-ETF'), example: beispiel }
    case 'usa':
      return { title: t('depot.block.usa', 'USA-ETF'), example: beispiel }
    case 'japan':
      return { title: t('depot.block.japan', 'Japan-ETF'), example: beispiel }
    case 'pacific':
      return { title: t('depot.block.pacific', 'Pazifik-ETF ohne Japan'), example: beispiel }
    case 'smallCaps':
      return { title: t('depot.block.smallCaps', 'Nebenwerte-ETF (Small Caps)'), example: beispiel }
    case 'bonds':
      return { title: t('depot.block.bonds', 'Anleihen-ETF (Euro-Staatsanleihen)'), example: null }
    case 'gold':
      return { title: t('depot.block.gold', 'Gold-ETC'), example: null }
    case 'cash':
      return { title: t('depot.block.cash', 'Tagesgeld oder Geldmarkt-ETF'), example: null }
    default:
      return { title: index, example: null }
  }
}

const punkte = (anteil: number) =>
  (anteil * 100).toLocaleString(currentFormatterLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 })

/** Euro-Betrag zu einem Anteil, wenn der Depotwert bekannt ist - auf 50 € gerundet. */
const euro = (anteil: number, value: number | null) =>
  value ? ` (≈ ${formatEur(Math.round((anteil * value) / 50) * 50)})` : ''

/** Betrag als Anteil des Depotwerts, mit Euro, wenn der Depotwert bekannt ist. */
function betrag(anteil: number, value: number | null, t: Translate): string {
  if (!Number.isFinite(anteil)) return t('depot.goals.unreachable', 'nicht durch Zukauf erreichbar')
  return t('depot.goals.ofValue', '{share} des Depotwerts', { share: pct(anteil) }) + euro(anteil, value)
}

/** Prozentfeld, das leer sein darf: leer = keine Grenze. */
function GrenzFeld({
  value,
  label,
  onCommit,
}: {
  readonly value: number | null
  readonly label: string
  readonly onCommit: (value: number | null) => void
}) {
  const [entwurf, setEntwurf] = useState<string | null>(null)
  const anzeige =
    entwurf ??
    (value === null ? '' : (value * 100).toLocaleString(currentFormatterLocale(), { maximumFractionDigits: 1 }))
  const uebernehmen = () => {
    if (entwurf === null) return
    const text = entwurf.trim().replace('%', '').replace(',', '.')
    if (text === '') onCommit(null)
    else {
      const zahl = Number.parseFloat(text)
      if (Number.isFinite(zahl) && zahl >= 0 && zahl <= 100) onCommit(zahl / 100)
    }
    setEntwurf(null)
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        inputMode="decimal"
        aria-label={label}
        value={anzeige}
        placeholder="–"
        onChange={(e) => setEntwurf(e.target.value)}
        onBlur={uebernehmen}
        onKeyDown={(e) => {
          if (e.key === 'Enter') uebernehmen()
          if (e.key === 'Escape') setEntwurf(null)
        }}
        className={cn(EINGABE, 'w-14 text-right tabular-nums')}
      />
      <span aria-hidden className="text-xs text-[var(--text-muted)]">
        %
      </span>
    </span>
  )
}

/** Heutiger Anteil als Balken, das Zielband dahinter. */
function Band({ check }: { readonly check: GoalCheck }) {
  const { min, max } = check.target
  const von = min ?? 0
  const bis = max ?? 1
  const ok = check.status === 'ok'
  return (
    <span aria-hidden className="relative block h-2 rounded-full bg-[var(--grid)]">
      <span
        className="absolute inset-y-0 rounded-full bg-[var(--chart-3)] opacity-30"
        style={{ left: `${von * 100}%`, width: `${Math.max(0.5, (bis - von) * 100)}%` }}
      />
      {check.current !== null ? (
        <span
          className={cn(
            'absolute top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full',
            ok ? 'bg-[var(--chart-3)]' : 'bg-[var(--chart-2)]',
          )}
          style={{ left: `${Math.min(1, check.current) * 100}%` }}
        />
      ) : null}
    </span>
  )
}

function statusText(c: GoalCheck, t: Translate): string {
  switch (c.status) {
    case 'ok':
      return t('depot.goals.ok', 'im Ziel')
    case 'below':
      return t('depot.goals.below', '{gap} Prozentpunkte zu wenig', { gap: punkte(c.gap) })
    case 'above':
      return t('depot.goals.above', '{gap} Prozentpunkte zu viel', { gap: punkte(c.gap) })
    case 'noData':
      return t('depot.goals.noData', 'keine Daten')
  }
}

function hebelText(c: GoalCheck, value: number | null, t: Translate): string | null {
  const name = keyLabel(c.target.dim, c.key, t)
  if (c.status === 'below') {
    return t('depot.goals.buyBelow', 'Ohne Verkauf: rund {amount} in {name} zukaufen.', {
      amount: betrag(c.buy, value, t),
      name,
    })
  }
  if (c.status === 'above') {
    return t(
      'depot.goals.buyAbove',
      'Ohne Verkauf: rund {amount} in anderes als {name} anlegen – oder {shift} umschichten.',
      { amount: betrag(c.buy, value, t), name, shift: pct(c.shift) },
    )
  }
  return null
}

function ZielZeile({
  check,
  value,
  onChange,
  onRemove,
}: {
  readonly check: GoalCheck
  readonly value: number | null
  readonly onChange: (patch: Pick<GoalTarget, 'min' | 'max'>) => void
  readonly onRemove: () => void
}) {
  const t = useT()
  const { target } = check
  const name = keyLabel(target.dim, check.key, t)
  const regel = target.key === EACH_KEY && check.key !== EACH_KEY ? keyLabel(target.dim, EACH_KEY, t) : null
  const hebel = hebelText(check, value, t)
  const offen = check.status === 'below' || check.status === 'above'
  const Icon = offen ? CircleAlert : CheckCircle2
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 border-t border-[var(--hairline)] py-3 first:border-t-0 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
          {name}
          {regel ? <span className="font-normal text-[var(--text-muted)]"> · {regel}</span> : null}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          {check.status !== 'noData' ? (
            <Icon
              size={12}
              aria-hidden
              className={cn(
                'mr-1 inline-block align-[-2px]',
                offen ? 'text-[var(--chart-2)]' : 'text-[var(--chart-3)]',
              )}
            />
          ) : null}
          {check.current !== null ? `${pct(check.current)} · ` : ''}
          {statusText(check, t)}
        </p>
      </div>
      <div className="order-last col-span-2 self-center sm:order-none sm:col-span-1">
        <Band check={check} />
        {hebel ? <p className="mt-1.5 text-xs text-[var(--text-muted)]">{hebel}</p> : null}
      </div>
      <div className="flex items-center gap-1.5 self-start">
        {target.key === EACH_KEY ? (
          <span className="text-xs text-[var(--text-muted)]">{t('depot.goals.max', 'höchstens')}</span>
        ) : (
          <>
            <GrenzFeld
              value={target.min}
              label={t('depot.goals.minOf', 'Mindestens, {name}', { name })}
              onCommit={(min) => onChange({ min, max: target.max })}
            />
            <span aria-hidden className="text-xs text-[var(--text-muted)]">
              –
            </span>
          </>
        )}
        <GrenzFeld
          value={target.max}
          label={t('depot.goals.maxOf', 'Höchstens, {name}', { name })}
          onCommit={(max) => onChange({ min: target.min, max })}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('depot.goals.remove', 'Ziel {name} entfernen', { name: regel ?? name })}
          className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--grid)] hover:text-[var(--text-primary)]"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </li>
  )
}

function laenderOptionen(look: LookThrough): string[] {
  const codes = new Set<string>()
  for (const s of look.countries) if (/^[A-Z]{2}$/.test(s.key)) codes.add(s.key)
  for (const info of Object.values(COUNTRIES)) codes.add(info.code)
  return [...codes]
}

/** Neues Ziel: Dimension, Schlüssel, Grenzen. */
function ZielNeu({
  look,
  onAdd,
}: {
  readonly look: LookThrough
  readonly onAdd: (target: GoalTarget) => void
}) {
  const t = useT()
  const id = useId()
  const [dim, setDim] = useState<GoalDim>('market')
  const [key, setKey] = useState('emerging')
  const [min, setMin] = useState<number | null>(0.1)
  const [max, setMax] = useState<number | null>(null)

  const keys = useMemo(() => {
    const roh = dim === 'country' ? laenderOptionen(look) : [...GOAL_KEYS[dim]]
    const sortiert = roh
      .map((k) => ({ k, label: keyLabel(dim, k, t) }))
      .sort((a, b) => (dim === 'country' ? a.label.localeCompare(b.label, currentFormatterLocale()) : 0))
    return dim === 'country' || dim === 'sector'
      ? [{ k: EACH_KEY, label: keyLabel(dim, EACH_KEY, t) }, ...sortiert]
      : sortiert
  }, [dim, look, t])

  const waehleDim = (d: GoalDim) => {
    setDim(d)
    const erster = d === 'country' ? 'US' : GOAL_KEYS[d as Exclude<GoalDim, 'country'>][0]
    setKey(erster)
  }
  const jeder = key === EACH_KEY

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-[var(--text-secondary)]" htmlFor={`${id}-dim`}>
        <span className="mb-1 block">{t('depot.goals.dim', 'Worauf')}</span>
        <select id={`${id}-dim`} className={EINGABE} value={dim} onChange={(e) => waehleDim(e.target.value as GoalDim)}>
          {GOAL_DIMS.map((d) => (
            <option key={d} value={d}>
              {dimLabel(d, t)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-[var(--text-secondary)]" htmlFor={`${id}-key`}>
        <span className="mb-1 block">{t('depot.goals.key', 'Was')}</span>
        <select id={`${id}-key`} className={cn(EINGABE, 'max-w-[14rem]')} value={key} onChange={(e) => setKey(e.target.value)}>
          {keys.map((o) => (
            <option key={o.k} value={o.k}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <span className="text-xs text-[var(--text-secondary)]">
        <span className="mb-1 block">{jeder ? t('depot.goals.max', 'höchstens') : t('depot.goals.range', 'von – bis')}</span>
        <span className="flex items-center gap-1.5">
          {jeder ? null : (
            <>
              <GrenzFeld value={min} label={t('depot.goals.newMin', 'Mindestanteil')} onCommit={setMin} />
              <span aria-hidden>–</span>
            </>
          )}
          <GrenzFeld value={max} label={t('depot.goals.newMax', 'Höchstanteil')} onCommit={setMax} />
        </span>
      </span>
      <button
        type="button"
        className={cn(KNOPF, 'inline-flex items-center gap-1')}
        disabled={jeder ? max === null : min === null && max === null}
        onClick={() => onAdd({ dim, key, min: jeder ? null : min, max })}
      >
        <Plus size={14} aria-hidden />
        {t('depot.goals.add', 'Ziel hinzufügen')}
      </button>
    </div>
  )
}

function Vorlagen({ onApply }: { readonly onApply: (id: GoalPresetId) => void }) {
  const t = useT()
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {GOAL_PRESET_IDS.map((id) => {
        const { title, text } = presetText(id, t)
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onApply(id)}
              className="h-full w-full rounded-lg border border-[var(--hairline)] px-3 py-2 text-left hover:border-[var(--chart-1)] hover:bg-[var(--surface-page)]"
            >
              <span className="block text-sm font-medium text-[var(--text-primary)]">{title}</span>
              <span className="block text-xs text-[var(--text-secondary)]">{text}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Depotwert in Euro - optional, macht aus Anteilen Beträge. */
function DepotWert({ value }: { readonly value: number | null }) {
  const t = useT()
  const dispatch = useDispatch()
  const id = useId()
  const [entwurf, setEntwurf] = useState<string | null>(null)
  const anzeige = entwurf ?? (value === null ? '' : Math.round(value).toLocaleString(currentFormatterLocale()))
  const uebernehmen = () => {
    if (entwurf === null) return
    const roh = entwurf.replace(/[^\d,.-]/g, '')
    const deutsch = currentFormatterLocale().startsWith('de')
    const zahl = Number.parseFloat(deutsch ? roh.replace(/\./g, '').replace(',', '.') : roh.replace(/,/g, ''))
    dispatch(actions.setDepotValue(roh === '' || !Number.isFinite(zahl) ? null : zahl))
    setEntwurf(null)
  }
  return (
    <label htmlFor={id} className="inline-flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
      {t('depot.goals.value', 'Depotwert für Beträge in Euro')}
      <span className="inline-flex items-center gap-1">
        <input
          id={id}
          inputMode="decimal"
          value={anzeige}
          placeholder={t('depot.goals.valuePlaceholder', 'optional')}
          onChange={(e) => setEntwurf(e.target.value)}
          onBlur={uebernehmen}
          onKeyDown={(e) => {
            if (e.key === 'Enter') uebernehmen()
          }}
          className={cn(EINGABE, 'w-28 text-right tabular-nums')}
        />
        <span aria-hidden>€</span>
      </span>
    </label>
  )
}

export function GoalsView({
  look,
  goals,
  value,
  loading,
}: {
  readonly look: LookThrough
  readonly goals: readonly GoalTarget[]
  readonly value: number | null
  readonly loading: boolean
}) {
  const t = useT()
  const dispatch = useDispatch()
  const advice = useMemo(() => goalAdvice(look, goals), [look, goals])
  const setGoals = (next: readonly GoalTarget[]) => dispatch(actions.setDepotGoals(next))
  const ersetze = (target: GoalTarget) =>
    setGoals([...goals.filter((g) => !(g.dim === target.dim && g.key === target.key)), target])

  if (goals.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          {t(
            'depot.goals.intro',
            'Leg fest, wie dein Depot aufgeteilt sein soll – etwa mehr Schwellenländer oder kein Land über 50 %. Dann siehst du, was fehlt und welcher Zukauf am meisten bringt.',
          )}
        </p>
        <Vorlagen onApply={(id) => setGoals(applyPreset(goals, id))} />
        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            {t('depot.goals.custom', 'Eigenes Ziel festlegen')}
          </summary>
          <div className="mt-3">
            <ZielNeu look={look} onAdd={ersetze} />
          </div>
        </details>
      </div>
    )
  }

  const offen = advice.checks.filter((c) => c.status === 'below' || c.status === 'above')
  const mitDaten = advice.checks.filter((c) => c.status !== 'noData')
  const nachDim = GOAL_DIMS.flatMap((dim) => {
    const checks = advice.checks.filter((c) => c.target.dim === dim)
    return checks.length > 0 ? [{ dim, checks }] : []
  })
  // Bausteine, die kein Ziel erfüllen, nur zeigen, wenn es nichts Besseres gibt.
  const vorschlaege = advice.suggestions.some((v) => v.fixes > 0)
    ? advice.suggestions.filter((v) => v.fixes > 0)
    : advice.suggestions
  const bester = vorschlaege[0]
  // Liegt etwas weit über dem Ziel, bräuchte das Verdünnen mehr als das halbe Depot.
  const umschichten = offen.filter((c) => c.status === 'above' && c.buy > 0.5)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          {loading
            ? t('depot.loading', 'Lade Kurse und Fondsbestände …')
            : offen.length === 0 && mitDaten.length > 0
              ? t('depot.goals.allOk', 'Alle Ziele erfüllt.')
              : t('depot.goals.summary', '{ok} von {count} Zielen erfüllt', {
                  ok: mitDaten.length - offen.length,
                  count: advice.checks.length,
                })}
        </p>
        <DepotWert value={value} />
      </div>

      {offen.length > 0 && !loading ? (
        <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface-page)] p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {t('depot.goals.suggestTitle', 'So kommst du hin – ohne zu verkaufen')}
          </h3>
          {bester ? (
            <ol className="mt-2 space-y-2">
              {vorschlaege.map((s, i) => {
                const { title, example } = blockText(s.block, s.index, t)
                return (
                  <li key={s.block} className={cn('text-sm', i > 0 && 'text-[var(--text-secondary)]')}>
                    <span className={cn(i === 0 && 'font-medium text-[var(--text-primary)]')}>{title}</span>
                    {example ? <span className="text-[var(--text-muted)]"> ({example})</span> : null}
                    <span>
                      {' – '}
                      {t('depot.goals.suggestAmount', 'rund {amount} zukaufen', {
                        amount: betrag(s.amount, value, t),
                      })}
                    </span>
                    <span className="block text-xs text-[var(--text-muted)]">
                      {s.after < 1e-4
                        ? t('depot.goals.suggestAll', 'Danach passen alle Ziele.')
                        : t('depot.goals.suggestFixes', 'Erfüllt {fixes} von {open} offenen Zielen, Restabstand {rest} Prozentpunkte.', {
                            fixes: s.fixes,
                            open: offen.length,
                            rest: punkte(s.after),
                          })}
                    </span>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {t(
                'depot.goals.noSuggestion',
                'Kein einzelner breiter Baustein bringt dich näher ans Ziel. Probiere im Was-wäre-wenn andere Anteile oder passe die Ziele an.',
              )}
            </p>
          )}
          {umschichten.length > 0 ? (
            <p className="mt-3 text-xs text-[var(--text-secondary)]">
              {t(
                'depot.goals.rebalance',
                'Bei {names} reicht Zukaufen allein kaum – dort hilft eher Umschichten: rund {shift} des Depotwerts.',
                {
                  names: umschichten.map((c) => keyLabel(c.target.dim, c.key, t)).join(', '),
                  shift: (() => {
                    const summe = umschichten.reduce((s, c) => s + c.shift, 0)
                    return pct(summe) + euro(summe, value)
                  })(),
                },
              )}
            </p>
          ) : null}
          {advice.plan ? (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">{t('depot.goals.planTitle', 'Kombiniert:')}</span>{' '}
              {advice.plan.steps
                .map((s) => `${pct(s.amount)} ${blockText(s.block, s.index, t).title}`)
                .join(' + ')}
              {' – '}
              {advice.plan.open === 0
                ? t('depot.goals.planAll', 'damit passen alle Ziele ({total} zusätzlich).', {
                    total: betrag(advice.plan.total, value, t),
                  })
                : advice.plan.open === 1
                  ? t('depot.goals.planOne', 'danach ist noch ein Ziel offen ({total} zusätzlich).', {
                      total: betrag(advice.plan.total, value, t),
                    })
                  : t('depot.goals.planSome', 'danach sind noch {open} Ziele offen ({total} zusätzlich).', {
                      open: advice.plan.open,
                      total: betrag(advice.plan.total, value, t),
                    })}
            </p>
          ) : null}
        </div>
      ) : null}

      {nachDim.map(({ dim, checks }) => {
        const abdeckung = checks[0]?.coverage ?? 1
        return (
          <section key={dim}>
            <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{dimLabel(dim, t)}</h3>
            {abdeckung < 0.9 && !loading ? (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {abdeckung > 0
                  ? t(
                      'depot.goals.coverage',
                      'Nur für {share} bekannt – die Anteile beziehen sich auf diesen Teil. Fehlende Daten unter „Daten & Quellen“ ergänzen.',
                      { share: pct(abdeckung) },
                    )
                  : t('depot.goals.coverageNone', 'Dafür fehlen noch Daten – unter „Daten & Quellen“ ergänzen.')}
              </p>
            ) : null}
            <ul className="mt-1">
              {checks.map((c) => (
                <ZielZeile
                  key={`${c.target.dim}|${c.target.key}|${c.key}`}
                  check={c}
                  value={value}
                  onChange={(patch) => ersetze({ ...c.target, ...patch })}
                  onRemove={() => setGoals(goals.filter((g) => g !== c.target))}
                />
              ))}
            </ul>
          </section>
        )
      })}

      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          {t('depot.goals.more', 'Ziel hinzufügen oder Vorlage übernehmen')}
        </summary>
        <div className="mt-3 space-y-4">
          <ZielNeu look={look} onAdd={ersetze} />
          <Vorlagen onApply={(id) => setGoals(applyPreset(goals, id))} />
          <button type="button" className={KNOPF} onClick={() => setGoals([])}>
            {t('depot.goals.clear', 'Alle Ziele löschen')}
          </button>
        </div>
      </details>

      <p className="text-xs text-[var(--text-muted)]">
        {t(
          'depot.goals.footer',
          'Rechnet nur deine eigenen Ziele nach, bezogen auf das Engagement (Hebel zählt mit); Regionen, Länder, Branchen und Größen auf den Aktienteil. Bausteine sind Indizes als Beispiel, keine Produktempfehlung und keine Anlageberatung.',
        )}
      </p>
    </div>
  )
}
