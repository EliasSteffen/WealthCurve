import {
  Area,
  CartesianGrid,
  ComposedChart,
  Label,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ChartStyle } from '../../core/chart-style'
import type { ProjectionLine, ProjectionRow } from '../../core/projection'
import { formatEur, formatEurCompact } from '../../lib/format'
import { useT } from '../../react/localeContext'
import { sketchCurve } from '../../render/sketchCurve'
import { ChartTooltip } from './ChartTooltip'

interface GrowthChartProps {
  readonly rows: readonly ProjectionRow[]
  readonly series: readonly ProjectionLine[]
  readonly style: ChartStyle
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

export function GrowthChart({
  rows,
  series,
  style,
  primaryKey,
  retirementYear,
}: GrowthChartProps) {
  const t = useT()
  const lastIndex = rows.length - 1

  // Bei Amplitude 0 die eingebaute Kurve nehmen - der Skizzenpfad kostet sonst
  // ohne Wirkung Rechenzeit.
  const curve = style.line.jitter > 0 ? sketchCurve(style.line.jitter) : style.line.curve

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
        fontSize={style.labels.fontSize}
        className="fill-[var(--text-primary)] font-semibold"
      >
        {formatEur(value)}
      </text>
    )
  }

  const tick = { fill: 'var(--text-muted)', fontSize: style.axis.fontSize }

  return (
    // ResponsiveContainer misst seinen Parent - der braucht eine definite Höhe,
    // sonst kollabiert der Chart auf 0x0 und rendert stumm nichts. Die Höhe
    // kommt hier aus dem Flex-Container; min-h-0 erlaubt das Schrumpfen.
    <div
      className="min-h-0 w-full flex-1"
      style={style.fontFamily ? { fontFamily: style.fontFamily } : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        {/* ComposedChart statt LineChart, damit Stile mit Fläche unter der
            Kurve dieselbe Komponente nutzen können - <Area> mit Deckkraft 0
            sieht exakt aus wie eine Linie. */}
        <ComposedChart
          data={rows as ProjectionRow[]}
          margin={{ top: 16, right: 24, bottom: style.axis.show ? 24 : 8, left: 8 }}
        >
          {/* Recharts' Default ist gestrichelt ("3 3") - ohne ausdrückliche
              Angabe läse sich das Gitter als Schwelle statt als Raster. */}
          {style.grid.show ? (
            <CartesianGrid
              stroke="var(--grid)"
              strokeDasharray={style.grid.dash ?? '0'}
              vertical={false}
            />
          ) : null}

          <XAxis
            dataKey="year"
            hide={!style.axis.show}
            tickLine={style.axis.tickLine}
            axisLine={{ stroke: 'var(--axis)' }}
            tick={tick}
            minTickGap={24}
            // Ohne das fällt Jahr 0 weg, obwohl die Daten dort beginnen.
            interval="preserveStartEnd"
          >
            <Label
              value={t('chart.years', 'Jahre')}
              position="insideBottom"
              offset={-12}
              style={{ fill: 'var(--text-muted)', fontSize: style.axis.fontSize }}
            />
          </XAxis>

          {/* Eine gemeinsame Y-Achse - alle Serien sind in Euro. Eine zweite
              Achse würde eine Korrelation suggerieren, die es nicht gibt. */}
          <YAxis
            width="auto"
            hide={!style.axis.show}
            tickLine={style.axis.tickLine}
            axisLine={false}
            tick={tick}
            tickFormatter={formatEurCompact}
          />

          {/* Markiert den Übergang von Ansparen zu Entnehmen. */}
          {retirementYear !== undefined && retirementYear > 0 && retirementYear < rows.length - 1 ? (
            <ReferenceLine
              x={retirementYear}
              stroke="var(--axis)"
              strokeWidth={1}
              label={{
                value: t('chart.retirement', 'Rentenbeginn'),
                position: 'insideTopLeft',
                fill: 'var(--text-muted)',
                fontSize: style.axis.fontSize,
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
            <Area
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stroke={s.colorVar}
              strokeWidth={style.line.width}
              strokeLinecap={style.line.cap}
              strokeLinejoin="round"
              strokeDasharray={s.dash}
              strokeOpacity={s.opacity}
              fill={s.colorVar}
              fillOpacity={style.area.opacity}
              type={curve}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }}
              // Ohne das startet die Einblend-Animation bei jedem Reglerpixel neu.
              isAnimationActive={false}
              // Szenarien dürfen unterschiedlich lang laufen - keine erfundene
              // Verbindungslinie über die Lücke.
              connectNulls={false}
            >
              {s.key === primaryKey && style.labels.endLabels === 'primary' ? (
                <LabelList dataKey={s.key} content={EndLabel} />
              ) : null}
            </Area>
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
