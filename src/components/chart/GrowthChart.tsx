import {
  CartesianGrid,
  Label,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ProjectionRow, ProjectionLine } from '../../core/projection'
import { formatEur, formatEurCompact } from '../../lib/format'
import { ChartTooltip } from './ChartTooltip'

interface GrowthChartProps {
  readonly rows: readonly ProjectionRow[]
  readonly series: readonly ProjectionLine[]
  /** Diese eine Serie bekommt eine Direktbeschriftung am Kurvenende. */
  readonly primaryKey?: string
  /** Jahr des Phasenwechsels; 0 oder undefined blendet die Markierung aus. */
  readonly retirementYear?: number
}

// Recharts typisiert Label-Koordinaten als string | number.
interface EndLabelProps {
  readonly index?: number
  readonly x?: string | number
  readonly y?: string | number
  readonly value?: unknown
}

export function GrowthChart({ rows, series, primaryKey, retirementYear }: GrowthChartProps) {
  const lastIndex = rows.length - 1

  /*
   * Nur EINE Direktbeschriftung, am Ende der Hauptkurve. Ein Wert an jedem Punkt
   * wäre Chaos, und mehrere End-Labels kollidieren, sobald die Kurven
   * konvergieren. Alle übrigen Werte tragen Legende, Tooltip und Tabelle.
   */
  const EndLabel = ({ index, x, y, value }: EndLabelProps) => {
    if (index !== lastIndex || typeof value !== 'number') return null
    const px = Number(x)
    const py = Number(y)
    if (!Number.isFinite(px) || !Number.isFinite(py)) return null
    return (
      <text
        x={px - 6}
        y={py - 10}
        textAnchor="end"
        className="fill-[var(--text-primary)] text-[11px] font-semibold"
      >
        {formatEur(value)}
      </text>
    )
  }

  return (
    // ResponsiveContainer misst seinen Parent - der braucht eine definite Höhe,
    // sonst kollabiert der Chart auf 0x0 und rendert stumm nichts.
    <div className="h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows as ProjectionRow[]} margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
          {/* Recharts' Default ist gestrichelt ("3 3") - Gitter sind durchgezogene
              Haarlinien, sonst lesen sie sich als Schwelle statt als Raster. */}
          <CartesianGrid stroke="var(--grid)" strokeDasharray="0" vertical={false} />

          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={{ stroke: 'var(--axis)' }}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            minTickGap={24}
            // Ohne das faellt Jahr 0 weg, obwohl die Daten dort beginnen.
            interval="preserveStartEnd"
          >
            <Label
              value="Jahre"
              position="insideBottom"
              offset={-12}
              style={{ fill: 'var(--text-muted)', fontSize: 11 }}
            />
          </XAxis>

          {/* Eine gemeinsame Y-Achse - alle Serien sind in Euro. Eine zweite
              Achse würde eine Korrelation suggerieren, die es nicht gibt. */}
          <YAxis
            width="auto"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickFormatter={formatEurCompact}
          />

          {/* Markiert den Übergang von Ansparen zu Entnehmen. */}
          {retirementYear !== undefined && retirementYear > 0 && retirementYear < rows.length - 1 ? (
            <ReferenceLine
              x={retirementYear}
              stroke="var(--axis)"
              strokeWidth={1}
              label={{
                value: 'Rentenbeginn',
                position: 'insideTopLeft',
                fill: 'var(--text-muted)',
                fontSize: 11,
              }}
            />
          ) : null}

          <Tooltip
            content={<ChartTooltip series={series} />}
            cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
          />

          {/* Zeichenreihenfolge umgekehrt: SVG kennt kein z-index, also muss die
              Hauptkurve zuletzt gemalt werden, damit sie obenauf liegt. */}
          {[...series].reverse().map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stroke={s.colorVar}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={s.dash}
              strokeOpacity={s.opacity}
              type="monotone"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }}
              // Ohne das startet die Einblend-Animation bei jedem Reglerpixel neu.
              isAnimationActive={false}
              // Szenarien duerfen unterschiedlich lang laufen - keine erfundene
              // Verbindungslinie über die Lücke.
              connectNulls={false}
            >
              {s.key === primaryKey ? <LabelList dataKey={s.key} content={EndLabel} /> : null}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
