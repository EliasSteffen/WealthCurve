import { Download, Film, Repeat, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_SPEC,
  VIDEO_FORMATS,
  frameAt,
  frameCount,
  resolveFormat,
  totalSeconds,
  type AnimationSpec,
  type Scene,
} from '../../core/animation'
import { CHART_STYLES } from '../../core/chart-style'
import { selectChartStyle, selectProjection } from '../../core/derive'
import { actions } from '../../core/state'
import { formatEur, formatPercent, formatYears } from '../../lib/format'
import { pickRecordingFormat, recordCanvas } from '../../lib/recordCanvas'
import { transcodeToMp4 } from '../../lib/transcodeToMp4'
import { useDispatch, useSelector } from '../../react/useSelector'
import { drawFrame } from '../../render/canvas/drawFrame'
import { readLineColors, readRenderTheme } from '../../render/canvas/readTheme'
import { SelectField } from '../ui/SelectField'

type Zustand = 'bereit' | 'laeuft' | 'fertig'

export function VideoDialog() {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--grid)]"
      >
        <Film size={14} aria-hidden />
        Video
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false)
        }}
        className="video-dialog"
        aria-label="Video erstellen"
      >
        {open ? <VideoDialogInhalt onClose={() => setOpen(false)} /> : null}
      </dialog>
    </>
  )
}

function VideoDialogInhalt({ onClose }: { readonly onClose: () => void }) {
  const dispatch = useDispatch()
  const projection = useSelector(selectProjection)
  const style = useSelector(selectChartStyle)
  const chartStyleId = useSelector((s) => s.chartStyleId)
  const scenarios = useSelector((s) => s.scenarios)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [spec, setSpec] = useState<AnimationSpec>(DEFAULT_SPEC)
  const [zustand, setZustand] = useState<Zustand>('bereit')
  const [fortschritt, setFortschritt] = useState(0)
  const [ergebnis, setErgebnis] = useState<{ url: string; endung: string; blob: Blob } | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [wandeltUm, setWandeltUm] = useState(false)
  const [umwandelFortschritt, setUmwandelFortschritt] = useState(0)

  const model = useSelector((s) => s.model)
  const format = useMemo(() => resolveFormat(spec.formatId), [spec.formatId])
  const gesamt = useMemo(() => frameCount(spec), [spec])
  const aufnahmeFormat = useMemo(() => pickRecordingFormat(), [])
  const aktiv = scenarios.find((s) => s.visible)
  const titel = aktiv?.label ?? 'Zinseszins'

  /**
   * Werte für die Platzhalter im Szenentext - hier fertig formatiert, damit der
   * Renderer nur noch einsetzen muss.
   */
  const facts = useMemo(() => {
    const summary = projection.summaries[0]
    const p = aktiv?.params
    const letzte = projection.rows.at(-1)
    const zins = summary?.final.interest ?? 0
    return {
      endkapital: formatEur(summary?.final.balance ?? 0),
      eingezahlt: formatEur(summary?.final.contributions ?? 0),
      zinsertrag: formatEur(zins),
      rentenkapital: formatEur(summary?.capitalAtRetirement ?? 0),
      entnahme: formatEur(summary?.monthlyWithdrawal ?? 0),
      rate: formatEur(p?.monthlyContribution ?? 0),
      rendite: formatPercent(p?.annualRate ?? 0),
      ansparjahre: String(model.accumulationYears),
      jahre: formatYears(letzte?.year ?? 0),
      reicht:
        summary?.depletedAtYear == null ? 'reicht durch' : `bis Jahr ${summary.depletedAtYear}`,
    } as Record<string, string>
  }, [projection, aktiv, model.accumulationYears])

  const zeichne = useCallback(
    (index: number) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      drawFrame(ctx, {
        frame: frameAt(spec, projection, index),
        projection,
        style,
        format,
        theme: readRenderTheme(),
        colors: readLineColors(projection.lines),
        title: titel,
        facts,
      })
    },
    [spec, projection, style, format, titel, facts],
  )

  // Vorschau: einmal durchlaufen lassen, solange nicht aufgenommen wird.
  useEffect(() => {
    if (zustand === 'laeuft') return
    let raf = 0
    let start = 0
    const schritt = (t: number) => {
      if (!start) start = t
      const index = Math.floor(((t - start) / 1000) * spec.fps) % gesamt
      zeichne(index)
      raf = requestAnimationFrame(schritt)
    }
    raf = requestAnimationFrame(schritt)
    return () => cancelAnimationFrame(raf)
  }, [zeichne, gesamt, spec.fps, zustand])

  useEffect(() => () => {
    if (ergebnis) URL.revokeObjectURL(ergebnis.url)
  }, [ergebnis])

  const aufnehmen = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setFehler(null)
    setZustand('laeuft')
    setFortschritt(0)
    try {
      const aufnahme = await recordCanvas(canvas, {
        frameCount: gesamt,
        fps: spec.fps,
        draw: zeichne,
        onProgress: (done, total) => setFortschritt(done / total),
      })
      setErgebnis({
        url: URL.createObjectURL(aufnahme.blob),
        endung: aufnahme.format.extension,
        blob: aufnahme.blob,
      })
      setZustand('fertig')
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Unbekannter Fehler')
      setZustand('bereit')
    }
  }

  const umwandeln = async () => {
    if (!ergebnis) return
    setFehler(null)
    setWandeltUm(true)
    setUmwandelFortschritt(0)
    try {
      const mp4 = await transcodeToMp4(ergebnis.blob, { onProgress: setUmwandelFortschritt })
      URL.revokeObjectURL(ergebnis.url)
      setErgebnis({ url: URL.createObjectURL(mp4), endung: 'mp4', blob: mp4 })
    } catch (e) {
      setFehler(
        e instanceof Error ? `Umwandlung fehlgeschlagen: ${e.message}` : 'Umwandlung fehlgeschlagen',
      )
    } finally {
      setWandeltUm(false)
    }
  }

  const sekunden = Math.round(totalSeconds(spec))

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Video erstellen</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--text-primary)]"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row">
        {/* Die Vorschau bekommt den ganzen freien Platz - man muss beurteilen
            können, was aufgenommen wird. */}
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center rounded-lg bg-[var(--surface-1)] p-3">
          {/* Canvas rendert in voller Auflösung und wird nur per CSS verkleinert -
              das aufgenommene Bild bleibt dadurch scharf. */}
          <canvas
            ref={canvasRef}
            width={format.width}
            height={format.height}
            className="h-auto max-h-full w-auto max-w-full rounded border border-[var(--hairline)]"
            style={{ aspectRatio: `${format.width} / ${format.height}` }}
          />
        </div>

        <div className="w-full shrink-0 space-y-4 overflow-y-auto overscroll-contain lg:w-72">
          <SelectField
            label="Format"
            value={spec.formatId}
            onChange={(formatId) => setSpec((p) => ({ ...p, formatId }))}
            options={VIDEO_FORMATS.map((f) => ({
              value: f.id,
              label: f.label,
              description: `${f.width} × ${f.height}`,
            }))}
          />

          <SelectField
            label="Stil"
            value={chartStyleId}
            onChange={(id) => dispatch(actions.setChartStyle(id))}
            options={CHART_STYLES.map((s) => ({ value: s.id, label: s.label }))}
          />

          <SzenenEditor
            scenes={spec.scenes}
            onChange={(scenes) => setSpec((p) => ({ ...p, scenes }))}
            platzhalter={Object.keys(facts)}
          />

          {zustand === 'laeuft' ? (
            <div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--grid)]">
                <div
                  className="h-full rounded-full bg-[var(--chart-1)] transition-[width]"
                  style={{ width: `${Math.round(fortschritt * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                Nimmt auf … {Math.round(fortschritt * 100)} %
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={aufnehmen}
              disabled={!aufnahmeFormat || projection.lines.length === 0}
              className="w-full rounded-xl bg-[var(--chart-1)] px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Aufnehmen ({sekunden} s)
            </button>
          )}

          {ergebnis ? (
            <div className="space-y-2">
              <a
                href={ergebnis.url}
                download={`zinseszins.${ergebnis.endung}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--hairline)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--grid)]"
              >
                <Download size={15} aria-hidden />
                Herunterladen (.{ergebnis.endung})
              </a>

              {/* Nur wenn die Aufnahme WebM geworden ist - wer MP4 direkt
                  aufnehmen kann, braucht die 30 MB ffmpeg.wasm nie. */}
              {ergebnis.endung === 'webm' ? (
                wandeltUm ? (
                  <div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--grid)]">
                      <div
                        className="h-full rounded-full bg-[var(--chart-3)] transition-[width]"
                        style={{ width: `${Math.round(umwandelFortschritt * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                      Wandelt um … {Math.round(umwandelFortschritt * 100)} %
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={umwandeln}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--hairline)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--grid)]"
                  >
                    <Repeat size={14} aria-hidden />
                    In MP4 umwandeln (lädt ~30 MB)
                  </button>
                )
              ) : null}
            </div>
          ) : null}

          {fehler ? <p className="text-[11px] text-[var(--chart-8)]">{fehler}</p> : null}

          <p className="text-[11px] leading-snug text-[var(--text-muted)]">
            {aufnahmeFormat === null
              ? 'Dieser Browser kann keine Videos aufnehmen.'
              : aufnahmeFormat.extension === 'mp4'
                ? 'Aufnahme als MP4.'
                : 'Dieser Browser nimmt nur WebM auf. Nach der Aufnahme kannst du direkt hier nach MP4 umwandeln.'}
            {' '}Die Aufnahme läuft in Echtzeit, dauert also so lange wie das Video.
          </p>
        </div>
      </div>
    </>
  )
}

const SZENEN_TITEL: Record<Scene['kind'], string> = {
  hook: 'Aufhänger',
  build: 'Aufbau',
  punchline: 'Pointe',
}

/**
 * Bearbeitet die drei Abschnitte des Reels.
 *
 * Eine Dauer von 0 überspringt den Abschnitt - damit lässt sich auch ein
 * reines Aufbau-Video ohne Text erzeugen, ohne dass es dafür einen zweiten
 * Modus braucht.
 */
function SzenenEditor({
  scenes,
  onChange,
  platzhalter,
}: {
  readonly scenes: readonly Scene[]
  readonly onChange: (scenes: readonly Scene[]) => void
  readonly platzhalter: readonly string[]
}) {
  const aendern = (index: number, patch: Partial<Scene>) =>
    onChange(scenes.map((s, i) => (i === index ? { ...s, ...patch } : s)))

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-[var(--text-secondary)]">Szenen</div>

      {scenes.map((scene, index) => (
        <div key={scene.kind} className="rounded-lg border border-[var(--hairline)] p-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[var(--text-primary)]">
              {SZENEN_TITEL[scene.kind]}
            </span>
            <label className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={scene.seconds}
                onChange={(e) => aendern(index, { seconds: Math.max(0, e.target.valueAsNumber || 0) })}
                aria-label={`Dauer ${SZENEN_TITEL[scene.kind]} in Sekunden`}
                className="w-14 rounded border border-[var(--hairline)] bg-transparent px-1 py-0.5 text-right tabular-nums text-[var(--text-primary)] focus:border-[var(--chart-1)] focus:outline-none"
              />
              s
            </label>
          </div>
          <textarea
            value={scene.text}
            rows={2}
            onChange={(e) => aendern(index, { text: e.target.value })}
            aria-label={`Text ${SZENEN_TITEL[scene.kind]}`}
            disabled={scene.seconds === 0}
            className="w-full resize-none rounded border border-[var(--hairline)] bg-transparent px-1.5 py-1 text-[11px] leading-snug text-[var(--text-primary)] focus:border-[var(--chart-1)] focus:outline-none disabled:opacity-40"
          />
        </div>
      ))}

      <details className="text-[11px] text-[var(--text-muted)]">
        <summary className="cursor-pointer select-none">Platzhalter</summary>
        <p className="mt-1 leading-relaxed">
          {platzhalter.map((k) => `{{${k}}}`).join(' · ')}
        </p>
      </details>
    </div>
  )
}
