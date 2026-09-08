import { Download, Film, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_SPEC,
  VIDEO_FORMATS,
  frameAt,
  frameCount,
  resolveFormat,
  type AnimationSpec,
} from '../../core/animation'
import { CHART_STYLES } from '../../core/chart-style'
import { selectChartStyle, selectProjection } from '../../core/derive'
import { actions } from '../../core/state'
import { pickRecordingFormat, recordCanvas } from '../../lib/recordCanvas'
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
  const [ergebnis, setErgebnis] = useState<{ url: string; endung: string } | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const format = useMemo(() => resolveFormat(spec.formatId), [spec.formatId])
  const gesamt = useMemo(() => frameCount(spec), [spec])
  const aufnahmeFormat = useMemo(() => pickRecordingFormat(), [])
  const titel = scenarios.find((s) => s.visible)?.label ?? 'Zinseszins'

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
      })
    },
    [spec, projection, style, format, titel],
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
      })
      setZustand('fertig')
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Unbekannter Fehler')
      setZustand('bereit')
    }
  }

  const sekunden = Math.round(spec.durationSeconds + spec.holdSeconds)

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

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:flex-row">
        <div className="flex shrink-0 items-start justify-center">
          {/* Canvas rendert in voller Auflösung und wird nur per CSS verkleinert -
              das aufgenommene Bild bleibt dadurch scharf. */}
          <canvas
            ref={canvasRef}
            width={format.width}
            height={format.height}
            className="max-h-[46dvh] w-auto rounded-lg border border-[var(--hairline)]"
            style={{ aspectRatio: `${format.width} / ${format.height}` }}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-4 sm:w-64 sm:max-w-xs">
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

          <SelectField
            label="Länge"
            value={String(spec.durationSeconds)}
            onChange={(v) => setSpec((p) => ({ ...p, durationSeconds: Number(v) }))}
            options={[
              { value: '6', label: 'Kurz (6 s Aufbau)' },
              { value: '9', label: 'Mittel (9 s Aufbau)' },
              { value: '14', label: 'Lang (14 s Aufbau)' },
            ]}
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
            <a
              href={ergebnis.url}
              download={`zinseszins.${ergebnis.endung}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--hairline)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--grid)]"
            >
              <Download size={15} aria-hidden />
              Herunterladen (.{ergebnis.endung})
            </a>
          ) : null}

          {fehler ? <p className="text-[11px] text-[var(--chart-8)]">{fehler}</p> : null}

          <p className="text-[11px] leading-snug text-[var(--text-muted)]">
            {aufnahmeFormat === null
              ? 'Dieser Browser kann keine Videos aufnehmen.'
              : aufnahmeFormat.extension === 'mp4'
                ? 'Aufnahme als MP4 – direkt für Instagram und TikTok geeignet.'
                : 'Dieser Browser nimmt nur WebM auf. Für Instagram musst du die Datei noch nach MP4 umwandeln.'}
            {' '}Die Aufnahme läuft in Echtzeit, dauert also so lange wie das Video.
          </p>
        </div>
      </div>
    </>
  )
}
