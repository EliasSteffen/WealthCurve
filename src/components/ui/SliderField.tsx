import { Info } from 'lucide-react'
import { useId, useState, type CSSProperties } from 'react'
import type { ParamDefinition } from '../../core/domain/parameters'
import { cn } from '../../lib/cn'
import { formatDraftNumber, formatParamValue, parseLocaleNumber } from '../../lib/format'
import { useLocale } from '../../react/localeContext'

interface SliderFieldProps {
  readonly definition: ParamDefinition
  readonly value: number
  readonly onChange: (value: number) => void
}

/** Auf das Raster des Reglers runden - sonst schleppt jeder Pfeilschritt Gleitkomma-Reste mit. */
function aufRaster(wert: number, schritt: number): number {
  const stellen = Math.max(0, -Math.floor(Math.log10(schritt)))
  return Number((Math.round(wert / schritt) * schritt).toFixed(stellen))
}

/**
 * Eine Eingabezeile: Bezeichnung links, Wert rechts, Regler darunter.
 *
 * Das Zahlenfeld ist das Werkzeug für genaue Werte - in der Sprache der
 * Oberfläche eintippen, oder mit ↑/↓ um einen Schritt (mit Umschalt um zehn).
 * Der Regler ist das Werkzeug zum Ausprobieren. Die Erklärung steckt im
 * Info-Symbol statt dauerhaft darunter: dichter, aber nicht verloren - auch
 * Screenreader bekommen sie als Beschreibung des Feldes.
 */
export function SliderField({ definition, value, onChange }: SliderFieldProps) {
  const id = useId()
  const hinweisId = useId()
  const { locale } = useLocale()
  const [draft, setDraft] = useState<string | null>(null)
  const { min, max, step } = definition

  const commit = (raw: string) => {
    const parsed = parseLocaleNumber(raw, locale)
    if (!Number.isNaN(parsed)) onChange(parsed)
  }

  const schritt = (richtung: 1 | -1, gross: boolean) => {
    const neu = Math.min(max, Math.max(min, aufRaster(value + richtung * step * (gross ? 10 : 1), step)))
    onChange(neu)
    if (draft !== null) setDraft(formatDraftNumber(neu, locale))
  }

  const fuellung = max > min ? ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100 : 0

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="flex min-w-0 items-center gap-1 text-xs text-[var(--text-secondary)]">
          <span className="truncate">{definition.label}</span>
          {definition.hint ? (
            <span title={definition.hint} className="shrink-0 cursor-help text-[var(--text-muted)]">
              <Info size={11} aria-hidden />
            </span>
          ) : null}
        </label>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          aria-describedby={definition.hint ? hinweisId : undefined}
          value={draft ?? formatParamValue(value, definition.unit)}
          onFocus={(e) => {
            const roh = formatDraftNumber(value, locale)
            setDraft(roh)
            // Nach dem Neusetzen alles markieren, damit Tippen ersetzt - aber nur, solange
            // noch niemand getippt hat; sonst fräße die Markierung die ersten Zeichen.
            const feld = e.currentTarget
            requestAnimationFrame(() => {
              if (feld.value === roh && document.activeElement === feld) feld.select()
            })
          }}
          onChange={(e) => {
            setDraft(e.target.value)
            commit(e.target.value)
          }}
          onBlur={(e) => {
            commit(e.target.value)
            setDraft(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              schritt(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey)
            }
          }}
          className={cn(
            'h-7 w-[6.75rem] shrink-0 rounded border border-transparent bg-[var(--surface-2)] px-2',
            'text-right text-[13px] font-medium text-[var(--text-primary)]',
            'hover:border-[var(--hairline)] focus:border-[var(--accent-fill)] focus:outline-none',
          )}
        />
      </div>

      <input
        type="range"
        aria-label={definition.label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        // Pseudo-Elemente der Spur lassen sich nur per Klasse gestalten (index.css).
        className="slider mt-0.5 block"
        style={{ '--fill': `${fuellung}%` } as CSSProperties}
      />

      {definition.hint ? (
        <span id={hinweisId} className="sr-only">
          {definition.hint}
        </span>
      ) : null}
    </div>
  )
}
