import { Download, Music, Repeat, Subtitles, Trash2 } from 'lucide-react'
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
import { ladeTonspur, type Tonspur } from '../../lib/audioTrack'
import { pickRecordingFormat, recordCanvas } from '../../lib/recordCanvas'
import { transcodeToMp4 } from '../../lib/transcodeToMp4'
import { useT } from '../../react/localeContext'
import { useDispatch, useSelector } from '../../react/useSelector'
import { drawFrame } from '../../render/canvas/drawFrame'
import { buildFacts, suggestedFactKeys } from '../../render/facts'
import { toSrt } from '../../render/subtitles'
import { readLineColors, readRenderTheme } from '../../render/canvas/readTheme'
import { RENDER_THEMES, themeLineColors, type ThemeName } from '../../render/canvas/themes'
import { Checkbox } from '../ui/Checkbox'
import { SelectField } from '../ui/SelectField'

type Zustand = 'bereit' | 'laeuft' | 'fertig'

/**
 * Vorschau und Aufnahme, samt aller Einstellungen des Videos.
 *
 * Ohne eigene Dialoghülle: der Arbeitsbereich sitzt als Reiter in der
 * Einstellungsseite. Zwei Dialoge nebeneinander hätten bedeutet, dass Video-
 * und Diagramm-Einstellungen an verschiedenen Orten wohnen, obwohl sie
 * dieselbe Frage beantworten - wie das Ergebnis aussehen soll.
 */
export function VideoWorkspace() {
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
  // Die Datei, nicht die fertige Spur: ein AudioContext je Aufnahme, sonst
  // liefe nach dem zweiten Anlauf ein verbrauchter Puffer mit.
  const [tonDatei, setTonDatei] = useState<File | null>(null)
  const tonRef = useRef<HTMLInputElement>(null)
  const [umwandelFortschritt, setUmwandelFortschritt] = useState(0)

  const model = useSelector((s) => s.model)
  const t = useT()
  const format = useMemo(() => resolveFormat(spec.formatId), [spec.formatId])
  const gesamt = useMemo(() => frameCount(spec), [spec])
  const aufnahmeFormat = useMemo(() => pickRecordingFormat(), [])
  const aktiv = scenarios.find((s) => s.visible)
  const titel = aktiv?.label ?? 'Zinseszins'

  /**
   * Werte für die Platzhalter im Szenentext - hier fertig formatiert, damit der
   * Renderer nur noch einsetzen muss.
   */
  /**
   * Werte für die Platzhalter im Szenentext - hier fertig formatiert, damit der
   * Renderer nur noch einsetzen muss.
   */
  const facts = useMemo(
    () =>
      buildFacts(projection, model, {
        eur: formatEur,
        percent: formatPercent,
        years: formatYears,
      }),
    [projection, model],
  )

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
        // „app" liest die Farben aus dem DOM, ein festes Schema kommt aus der
        // Tabelle - so lässt sich ein dunkles Reel aufnehmen, ohne die ganze
        // Anwendung umzuschalten.
        theme: spec.theme && spec.theme !== 'app' ? RENDER_THEMES[spec.theme] : readRenderTheme(),
        colors:
          spec.theme && spec.theme !== 'app'
            ? themeLineColors(projection.lines, spec.theme)
            : readLineColors(projection.lines),
        title: titel,
        facts,
        showYear: spec.showYear !== false,
        showHeader: spec.showHeader !== false,
        showLegend: spec.showLegend !== false,
        hasWithdrawalPhase: model.withdrawalYears > 0,
        retirementLabel: t('chart.retirement', 'Rentenbeginn'),
      })
    },
    [spec, projection, style, format, titel, facts, model.withdrawalYears, t],
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
    let ton: Tonspur | null = null
    try {
      if (tonDatei) ton = await ladeTonspur(tonDatei)
      const aufnahme = await recordCanvas(canvas, {
        frameCount: gesamt,
        fps: spec.fps,
        draw: zeichne,
        onProgress: (done, total) => setFortschritt(done / total),
        audioTrack: ton?.track,
        // Erst wenn der Recorder läuft - alles davor fehlt am Anfang.
        onStart: () => ton?.start(),
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
    } finally {
      await ton?.dispose()
    }
  }

  /** Die Szenentexte als Datei - im Bild stehen sie ohnehin. */
  const untertitelLaden = () => {
    const blob = new Blob([toSrt(spec, facts)], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'zinseszins.srt'
    a.click()
    URL.revokeObjectURL(url)
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
  const hatUntertitel = toSrt(spec, facts).length > 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
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

          <SelectField
            label={t('video.theme', 'Farbschema')}
            value={spec.theme ?? 'app'}
            onChange={(theme) =>
              setSpec((p) => ({ ...p, theme: theme as 'app' | ThemeName }))
            }
            options={[
              {
                value: 'app',
                label: t('video.theme.app', 'Wie die Anwendung'),
                description: t('video.theme.app.hint', 'Folgt dem eingestellten Farbschema.'),
              },
              {
                value: 'light',
                label: t('video.theme.light', 'Hell'),
                description: t('video.theme.light.hint', 'Fester heller Grund, unabhängig davon.'),
              },
              {
                value: 'dark',
                label: t('video.theme.dark', 'Dunkel'),
                description: t('video.theme.dark.hint', 'Fester dunkler Grund, unabhängig davon.'),
              },
            ]}
          />

          <SelectField
            label={t('video.fps', 'Bilder pro Sekunde')}
            value={String(spec.fps)}
            onChange={(fps) => setSpec((p) => ({ ...p, fps: Number(fps) }))}
            options={[
              {
                value: '24',
                label: '24',
                description: t('video.fps.24', 'Kinolook, kleinste Datei.'),
              },
              {
                value: '30',
                label: '30',
                description: t('video.fps.30', 'Der übliche Wert für Reels.'),
              },
              {
                value: '60',
                label: '60',
                description: t('video.fps.60', 'Sehr flüssig, doppelte Datenmenge.'),
              },
            ]}
          />

          <div>
            <Checkbox
              checked={spec.showHeader !== false}
              onChange={(showHeader) => setSpec((p) => ({ ...p, showHeader }))}
              label={t('video.showHeader', 'Kopfzeile einblenden')}
              description={t(
                'video.showHeader.hint',
                'Name und aktueller Wert je Szenario. Aus, wenn nur die Kurve wirken soll.',
              )}
            />
            <Checkbox
              checked={spec.showLegend !== false}
              onChange={(showLegend) => setSpec((p) => ({ ...p, showLegend }))}
              label={t('video.showLegend', 'Legende einblenden')}
              description={t('video.showLegend.hint', 'Welche Linie welche Serie ist.')}
            />
            <Checkbox
              checked={spec.showYear !== false}
              onChange={(showYear) => setSpec((p) => ({ ...p, showYear }))}
              label={t('video.showYear', 'Jahreszahl einblenden')}
              description={t(
                'video.showYear.hint',
                'Läuft unter der Achse mit. Aus, wenn das Video ohne Zeitbezug wirken soll.',
              )}
            />
          </div>

          <SzenenEditor
            scenes={spec.scenes}
            onChange={(scenes) => setSpec((p) => ({ ...p, scenes }))}
            platzhalter={suggestedFactKeys(facts, projection.summaries.length)}
          />

          {/* Die Datei bleibt im Browser - gelesen wird sie über die Datei-API,
              hochgeladen wird nichts. */}
          <div>
            <div className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">
              {t('video.audio', 'Tonspur')}
            </div>
            <input
              ref={tonRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                setTonDatei(e.target.files?.[0] ?? null)
                setFehler(null)
              }}
            />
            {tonDatei ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--hairline)] px-2.5 py-2">
                <span className="min-w-0 truncate text-[11px] text-[var(--text-secondary)]">
                  {tonDatei.name}
                </span>
                <button
                  type="button"
                  onClick={() => setTonDatei(null)}
                  aria-label={t('video.audio.remove', 'Tonspur entfernen')}
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--text-primary)]"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => tonRef.current?.click()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--hairline)] px-2.5 py-2 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--grid)]"
              >
                <Music size={13} aria-hidden />
                {t('video.audio.pick', 'Audiodatei wählen')}
              </button>
            )}
            <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-muted)]">
              {t(
                'video.audio.hint',
                `Läuft ab Sekunde 0 und endet mit dem Video (${sekunden} s). Während der Aufnahme bleibt sie stumm – zu hören ist sie in der fertigen Datei.`,
                { sekunden: String(sekunden) },
              )}
            </p>
          </div>

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

              {/*
                Erst neben dem fertigen Video, nicht davor: eine Untertitelspur
                ohne die Aufnahme, zu der sie gehört, hilft niemandem - und
                nach der Aufnahme steht fest, welche Texte tatsächlich im Bild
                standen.
              */}
              {hatUntertitel ? (
                <button
                  type="button"
                  onClick={untertitelLaden}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--hairline)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--grid)]"
                >
                  <Subtitles size={15} aria-hidden />
                  {t('video.subtitles', 'Untertitel (.srt)')}
                </button>
              ) : null}

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
