/**
 * Die gezeichnete Weltkarte - eigene Datei, damit die Umrisse (rund 40 KB
 * gepackt) erst geladen werden, wenn die Karte zu sehen ist.
 */
import type { Continent } from '../../core/depot/lookthrough'
import { cn } from '../../lib/cn'
import { MAP_CONTINENTS, MAP_COUNTRIES, MAP_DOTS, MAP_HEIGHT, MAP_WIDTH } from './worldMap.generated'

export type MapLevel = 'continent' | 'country'
export type GoalState = 'ok' | 'off'

export interface WorldMapProps {
  readonly level: MapLevel
  /** Füllfarbe je Schlüssel (Kontinent-ID oder ISO-Code). */
  readonly fill: (key: string) => string
  readonly goal: (key: string) => GoalState | undefined
  /** Text für Tooltip und Screenreader. */
  readonly label: (key: string) => string
  readonly selected: string | null
  readonly hovered: string | null
  readonly onPick: (key: string) => void
  readonly onHover: (key: string | null) => void
  readonly ariaLabel: string
}

interface Form {
  readonly key: string
  readonly d?: string
  readonly dot?: { readonly x: number; readonly y: number }
}

/** Formen mit Ziel kommen zuletzt - sonst verdecken Nachbarn ihren farbigen Rand. */
const mitZielZuletzt = (formen: readonly Form[], goal: WorldMapProps['goal']) =>
  [...formen].sort((a, b) => Number(Boolean(goal(a.key))) - Number(Boolean(goal(b.key))))

export default function WorldMapSvg(props: WorldMapProps) {
  const { level, fill, goal, label, selected, hovered, onPick, onHover, ariaLabel } = props
  const formen: Form[] =
    level === 'continent'
      ? MAP_CONTINENTS.map((c) => ({ key: c.continent as Continent, d: c.d }))
      : [
          ...MAP_COUNTRIES.map((c) => ({ key: c.code, d: c.d })),
          ...MAP_DOTS.map((p) => ({ key: p.code, dot: { x: p.x, y: p.y } })),
        ]
  // Die Reihenfolge hängt nicht am Zeiger: Elemente unter der Maus umzusortieren
  // ließe den Rand flackern. Hover und Auswahl liegen als eigene Ebene obenauf.
  const sortiert = mitZielZuletzt(formen, goal)
  const oben = [hovered, selected].flatMap((key) => formen.filter((f) => key !== null && f.key === key))

  return (
    <svg
      viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
      role="group"
      aria-label={ariaLabel}
      className="block h-auto w-full"
      onMouseLeave={() => onHover(null)}
    >
      {sortiert.map((f) => {
        const zustand = goal(f.key)
        const gewaehlt = f.key === selected
        const text = label(f.key)
        const gemeinsam = {
          role: 'button',
          tabIndex: -1,
          'aria-label': text,
          'aria-pressed': gewaehlt,
          onClick: () => onPick(f.key),
          onMouseEnter: () => onHover(f.key),
          vectorEffect: 'non-scaling-stroke' as const,
          style: {
            fill: fill(f.key),
            stroke: zustand === 'ok' ? 'var(--chart-3)' : zustand === 'off' ? 'var(--chart-2)' : 'var(--surface-1)',
            strokeWidth: zustand ? 2 : 0.6,
          },
          className: cn('cursor-pointer outline-none transition-[stroke] duration-100'),
        }
        return f.dot ? (
          <circle key={f.key} cx={f.dot.x} cy={f.dot.y} r={4.5} {...gemeinsam}>
            <title>{text}</title>
          </circle>
        ) : (
          <path key={f.key} d={f.d} strokeLinejoin="round" {...gemeinsam}>
            <title>{text}</title>
          </path>
        )
      })}
      <g aria-hidden style={{ pointerEvents: 'none' }}>
        {oben.map((f, i) => {
          const stil = {
            fill: 'none',
            stroke: 'var(--text-primary)',
            strokeWidth: f.key === selected ? 2.5 : 1.5,
          }
          return f.dot ? (
            <circle key={i} cx={f.dot.x} cy={f.dot.y} r={4.5} vectorEffect="non-scaling-stroke" style={stil} />
          ) : (
            <path key={i} d={f.d} strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={stil} />
          )
        })}
      </g>
    </svg>
  )
}
