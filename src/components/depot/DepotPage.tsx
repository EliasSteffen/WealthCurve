import { Camera, MoreHorizontal, ScanSearch, Trash2, Upload } from 'lucide-react'
import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react'
import { marketPriceIndex } from '../../core/analytics'
import { depotFlags } from '../../core/depot/flags'
import { computeLookThrough } from '../../core/depot/lookthrough'
import { computeDepotStats, depotHistory, isWindowStats, scenarioRate, withWeights } from '../../core/depot/metrics'
import { parseDepotText, productId, withResolvedSymbols, type ParseIssue } from '../../core/depot/parse'
import { PARAMETERS } from '../../core/domain/parameters'
import { MAX_SCENARIOS, actions } from '../../core/state'
import type { DepotHolding } from '../../core/depot/types'
import type { Translate } from '../../i18n'
import { cn } from '../../lib/cn'
import { downloadBlob } from '../../lib/download'
import { formatEur } from '../../lib/format'
import { formatDecimal, signedPercent } from '../../lib/numbers'
import { useStoredState } from '../../lib/useStoredState'
import { useT } from '../../react/localeContext'
import { useStore } from '../../react/storeContext'
import { useDispatch, useSelector } from '../../react/useSelector'
import type { ChartHandle, ScaleMode } from '../charts/types'
import { ConfirmDialog } from '../shell/ConfirmDialog'
import { Card } from '../ui/Card'
import { Menu } from '../ui/Menu'
import { HeadStat, Panel, PanelHeader } from '../ui/Panel'
import { ToolButton, ToolDivider, ToolSegment } from '../ui/Toolbar'
import { DEPOT_DATEITYPEN, readDepotFile } from './depotFile'
import { pct } from './depotFormat'
import { BreakdownView, OverviewView, RisksView, WhatIfView } from './DepotViews'
import { GoalsView } from './GoalsView'
import { HoldingsEditor } from './HoldingsEditor'
import { notYetResolved, resolveSymbols } from './resolveSymbols'
import { useDepotData } from './useDepotData'

const PRIMAER =
  'inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--accent-fill)] px-3 text-xs font-medium text-[var(--on-accent)] hover:opacity-90 disabled:opacity-40'
const SEKUNDAER =
  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-[var(--text-primary)] ring-1 ring-inset ring-[var(--hairline)] hover:bg-[var(--grid)] disabled:opacity-40'

/** Öffentlich bekannte Wertpapiere - zum Ausprobieren, ohne eigene Datei. */
const BEISPIEL = [
  'WKN\tName\tAnteil\tTER\tTyp\tDurchschau',
  'A0RPWH\tiShares Core MSCI World\t60%\t0,20%\tETF\tIE000BI8OT95',
  'A2PLBK\tVanguard FTSE Developed Europe\t20%\t0,10%\tETF\tIE000BI8OT95:EU',
  '865985\tApple\t10%\t0%\tAktie\tUS0378331005',
  'A0S9GB\tXetra-Gold\t10%\t0%\tETC\tGold',
].join('\n')

function issueText(issue: ParseIssue, t: Translate): string {
  switch (issue.code) {
    case 'noHeader':
      return t(
        'depot.issue.noHeader',
        'Keine Kopfzeile gefunden – es braucht mindestens die Spalten „WKN“ (oder „ISIN“) und „Anteil“.',
      )
    case 'noRows':
      return t('depot.issue.noRows', 'Unter der Kopfzeile stehen keine Positionen.')
    case 'tooMany':
      return t('depot.issue.tooMany', 'Mehr als {max} Positionen – der Rest wurde nicht übernommen.', {
        max: issue.max,
      })
    case 'badWeight':
      return t('depot.issue.badWeight', 'Zeile {line}: Anteil „{value}“ ist keine Zahl.', {
        line: issue.line,
        value: issue.value,
      })
    case 'badSymbol':
      return t('depot.issue.badSymbol', 'Zeile {line}: Symbol „{value}“ ist ungültig.', {
        line: issue.line,
        value: issue.value,
      })
    case 'duplicate':
      return t('depot.issue.duplicate', 'Zeile {line}: {value} steht doppelt.', {
        line: issue.line,
        value: issue.value,
      })
  }
}

/** Kennungen von Positionen ohne Kurssymbol oder ohne Namen - dafür fragt die Seite nach. */
function offeneKennungen(holdings: readonly DepotHolding[]): string[] {
  return [
    ...new Set(
      holdings
        .filter((h) => !h.symbol || h.name === h.id)
        .map(productId)
        .filter((id): id is string => id !== null),
    ),
  ]
}

/**
 * Gespeicherte Depots nachbessern: Positionen, für die der Import kein Symbol
 * oder keinen Namen fand, werden einmal je Sitzung erneut nachgeschlagen.
 *
 * Ohne Namen erkennt die Durchschau keinen Index - eine WKN wie "ETF146"
 * (Amundi MSCI World) zählte sonst dauerhaft als "Unbekannt", bis man neu
 * importiert. Was der Anleger selbst eingetragen hat, bleibt unangetastet.
 */
function useDepotReparatur(holdings: readonly DepotHolding[]): void {
  const store = useStore()
  useEffect(() => {
    const offen = notYetResolved(offeneKennungen(holdings))
    if (offen.length === 0) return
    void resolveSymbols(offen).then((gefunden) => {
      if (gefunden.size === 0) return
      const aktuell = store.getSnapshot().depot.holdings
      withResolvedSymbols(aktuell, gefunden).forEach((neu, i) => {
        const alt = aktuell[i]
        if (!alt || neu === alt) return
        const patch: Partial<Omit<DepotHolding, 'id'>> = {}
        for (const feld of ['name', 'symbol', 'kind', 'leverage', 'lookThrough'] as const) {
          if (neu[feld] !== alt[feld]) Object.assign(patch, { [feld]: neu[feld] })
        }
        // Einzeln statt `setDepot`: die Was-wäre-wenn-Anteile bleiben gültig.
        if (Object.keys(patch).length > 0) store.dispatch(actions.updateDepotHolding(alt.id, patch))
      })
    })
  }, [holdings, store])
}

interface Import {
  readonly busy: boolean
  readonly issues: readonly ParseIssue[]
  readonly message: string | null
  readonly fileError: string | null
  readonly importText: (text: string) => Promise<boolean>
  readonly importFile: (file: File) => Promise<boolean>
}

/**
 * Einlesen, übernehmen, fehlende Kurssymbole nachschlagen.
 *
 * Lebt auf der Seite, nicht im Import-Feld: nach dem ersten Import wechselt die
 * Seite vom leeren Zustand zur Übersicht, und die Meldung über gefundene
 * Symbole soll diesen Wechsel überleben.
 */
function useDepotImport(): Import {
  const t = useT()
  const store = useStore()
  const [busy, setBusy] = useState(false)
  const [issues, setIssues] = useState<readonly ParseIssue[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const importText = async (text: string) => {
    setFileError(null)
    const ergebnis = parseDepotText(text)
    setIssues(ergebnis.issues)
    const count = ergebnis.holdings.length
    if (count === 0) {
      setMessage(null)
      return false
    }
    store.dispatch(actions.setDepot(ergebnis.holdings, ergebnis.totalValue))

    const gespeichert = store.getSnapshot().depot.holdings
    const offen = offeneKennungen(gespeichert)
    if (offen.length === 0) {
      setMessage(t('depot.panel.applied', '{count} Positionen übernommen.', { count }))
      return true
    }
    setBusy(true)
    setMessage(
      t('depot.panel.resolving', '{count} Positionen übernommen – suche Kurssymbole für {open} …', {
        count,
        open: offen.length,
      }),
    )
    try {
      const gefunden = await resolveSymbols(offen)
      // Inzwischen ein anderes Depot übernommen? Dann gilt dieses Ergebnis nicht mehr.
      if (store.getSnapshot().depot.holdings !== gespeichert) return true
      if (gefunden.size > 0) store.dispatch(actions.setDepot(withResolvedSymbols(gespeichert, gefunden)))
      setMessage(
        t(
          'depot.import.resolved',
          '{count} Positionen übernommen, {found} von {open} Kurssymbolen gefunden. Fehlende unter „Daten & Quellen“ eintragen.',
          { count, found: [...gefunden.values()].filter((g) => g.symbol).length, open: offen.length },
        ),
      )
    } finally {
      setBusy(false)
    }
    return true
  }

  const importFile = async (file: File) => {
    let inhalt: string
    try {
      inhalt = await readDepotFile(file)
    } catch {
      setIssues([])
      setMessage(null)
      setFileError(
        t(
          'depot.panel.fileError',
          '„{name}“ ließ sich nicht lesen. Möglich sind .xlsx, .csv, .tsv und .txt – .xls-, .numbers- oder .ods-Dateien bitte als .xlsx oder CSV speichern.',
          { name: file.name },
        ),
      )
      return false
    }
    return importText(inhalt)
  }

  return { busy, issues, message, fileError, importText, importFile }
}

/** Ablagefläche, Dateiauswahl und - für Excel-Kopien - ein Textfeld. */
function DepotImport({ imp, gross }: { readonly imp: Import; readonly gross: boolean }) {
  const t = useT()
  const dateiRef = useRef<HTMLInputElement>(null)
  const textId = useId()
  const [zeigeText, setZeigeText] = useState(false)
  const [text, setText] = useState('')
  const [darueber, setDarueber] = useState(false)

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setDarueber(true)
        }}
        onDragLeave={() => setDarueber(false)}
        onDrop={(e) => {
          setDarueber(false)
          const datei = e.dataTransfer.files[0]
          if (!datei) return
          e.preventDefault()
          void imp.importFile(datei)
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-md border border-dashed px-4 text-center transition-colors',
          gross ? 'py-12' : 'py-6',
          darueber ? 'border-[var(--accent-fill)] bg-[var(--surface-2)]' : 'border-[var(--axis)]',
        )}
      >
        <Upload size={gross ? 28 : 20} aria-hidden className="text-[var(--text-muted)]" />
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {t('depot.import.drop', 'Depot-Datei hierher ziehen')}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {t('depot.import.formats', '.xlsx, CSV oder Export deines Brokers – mit WKN oder ISIN und Anteil oder Wert')}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={PRIMAER} disabled={imp.busy} onClick={() => dateiRef.current?.click()}>
            {t('depot.import.choose', 'Datei auswählen')}
          </button>
          <button
            type="button"
            className={SEKUNDAER}
            aria-expanded={zeigeText}
            aria-controls={textId}
            onClick={() => setZeigeText((v) => !v)}
          >
            {t('depot.import.paste', 'Tabelle einfügen')}
          </button>
          {gross ? (
            <button type="button" className={SEKUNDAER} disabled={imp.busy} onClick={() => void imp.importText(BEISPIEL)}>
              {t('depot.import.example', 'Beispiel ansehen')}
            </button>
          ) : null}
        </div>
        <input
          ref={dateiRef}
          type="file"
          accept={DEPOT_DATEITYPEN}
          className="hidden"
          aria-label={t('depot.import.choose', 'Datei auswählen')}
          onChange={(e) => {
            const datei = e.target.files?.[0]
            e.target.value = ''
            if (datei) void imp.importFile(datei)
          }}
        />
      </div>

      <div id={textId} hidden={!zeigeText} className="space-y-2">
        <label htmlFor={`${textId}-feld`} className="block text-xs text-[var(--text-secondary)]">
          {t(
            'depot.import.pasteHint',
            'Zeilen aus Excel kopieren und hier einfügen – mit Kopfzeile (WKN oder ISIN, Anteil oder Wert; optional Name, Symbol, TER, Hebel, Typ).',
          )}
        </label>
        <textarea
          id={`${textId}-feld`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={BEISPIEL}
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] p-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-fill)] focus:outline-none"
        />
        <button type="button" className={PRIMAER} disabled={imp.busy || !text.trim()} onClick={() => void imp.importText(text)}>
          {t('depot.panel.apply', 'Übernehmen')}
        </button>
      </div>

      {imp.fileError ? (
        <p role="alert" className="text-sm text-[var(--text-primary)]">
          {imp.fileError}
        </p>
      ) : null}
      {imp.issues.length > 0 ? (
        <ul role="alert" className="space-y-1 text-sm text-[var(--text-primary)]">
          {imp.issues.map((issue, i) => (
            <li key={i}>{issueText(issue, t)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** Noch kein Depot: eine Aufgabe, eine Fläche. */
function DepotLeer({ imp }: { readonly imp: Import }) {
  const t = useT()
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-10 lg:py-16">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
          {t('depot.empty.title', 'Dein Depot durchleuchten')}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--text-secondary)]">
          {t(
            'depot.empty.text',
            'Rendite und Schwankung der letzten Jahre, was wirklich in deinen ETFs steckt – Länder, Branchen, größte Firmen – und wo sich Risiken bündeln.',
          )}
        </p>
      </div>
      <Card>
        <DepotImport imp={imp} gross />
      </Card>
      <p className="text-center text-xs text-[var(--text-muted)]">
        {t(
          'depot.empty.privacy',
          'Das Depot bleibt in diesem Browser. Für Kurse und Fondsbestände fragt der Server Yahoo, OpenFIGI und Amundi nach den Kennungen der Wertpapiere – nie nach dir.',
        )}
      </p>
    </div>
  )
}

type DepotTab = 'breakdown' | 'goals' | 'whatif' | 'positions' | 'data'
const DEPOT_TABS: readonly DepotTab[] = ['breakdown', 'goals', 'whatif', 'positions', 'data']
const isDepotTab = (v: unknown): v is DepotTab => DEPOT_TABS.includes(v as DepotTab)
const isScale = (v: unknown): v is ScaleMode => v === 'linear' || v === 'log' || v === 'percent'

/** Der Depot-Chart samt TradingView-Bibliothek lädt erst, wenn es etwas zu zeigen gibt. */
const MarketChart = lazy(() => import('../charts/MarketChart').then((m) => ({ default: m.MarketChart })))

/**
 * Das gefüllte Depot als Arbeitsplatz.
 *
 * Oben die Kennzahlen wie der Kopf eines Kurses, darunter der Verlauf der
 * heutigen Mischung als Kerzenchart und die Analysen in Reitern. Rechts stehen
 * die Auffälligkeiten - sie sollen nicht hinter einem Reiter verschwinden.
 */
function DepotUebersicht({ imp }: { readonly imp: Import }) {
  const t = useT()
  const dispatch = useDispatch()
  const depot = useSelector((s) => s.depot)
  const szenarien = useSelector((s) => s.scenarios.length)
  const data = useDepotData(depot.holdings)
  useDepotReparatur(depot.holdings)
  const [importOffen, setImportOffen] = useState(false)
  const [leerenFragen, setLeerenFragen] = useState(false)
  const [tab, setTab] = useStoredState<DepotTab>('depot.tab', 'breakdown', isDepotTab)
  const [skala, setSkala] = useStoredState<ScaleMode>('depot.scale', 'linear', isScale)
  const chartRef = useRef<ChartHandle>(null)

  const stats = useMemo(
    () => computeDepotStats(depot.holdings, data.series, data.fx),
    [depot.holdings, data.series, data.fx],
  )
  const look = useMemo(
    () => computeLookThrough(depot.holdings, data.funds, data.profiles),
    [depot.holdings, data.funds, data.profiles],
  )
  const flags = useMemo(() => depotFlags(depot.holdings, stats, look), [depot.holdings, stats, look])
  const variante = useMemo(() => withWeights(depot.holdings, depot.whatIf), [depot.holdings, depot.whatIf])
  const variantStats = useMemo(
    () => computeDepotStats(variante, data.series, data.fx),
    [variante, data.series, data.fx],
  )
  const variantLook = useMemo(
    () => computeLookThrough(variante, data.funds, data.profiles),
    [variante, data.funds, data.profiles],
  )
  const depotName = t('depot.chart.name', 'Depot')
  const verlauf = useMemo(() => {
    const reihe = depotHistory(depot.holdings, data.series, data.fx, depotName)
    return reihe ? marketPriceIndex(reihe) : null
  }, [depot.holdings, data.series, data.fx, depotName])
  // Ein fehlender Fondsbestand ist kein Fehler, wenn die Position anders zerlegt wurde.
  const fehler = data.errors.filter(
    (e) =>
      !depot.holdings.some(
        (h) => h.lookThrough.startsWith(e.source) && (look.sources[h.id]?.kind ?? 'none') !== 'none',
      ),
  )

  const haupt = stats.windows.find(isWindowStats)
  const rendite = scenarioRate(stats)
  const imSparplan = () => {
    if (rendite === null) return
    const { min, max } = PARAMETERS.annualRate
    const zins = Math.min(max, Math.max(min, rendite))
    dispatch(
      actions.addScenario(t('depot.whatif.labelToday', 'Depot heute ({rate})', { rate: pct(zins / 100) }), {
        annualRate: zins,
      }),
    )
    dispatch(actions.setPage('sparplan'))
  }
  const warnungen = flags.filter((f) => f.level === 'warn').length
  const chartText = useMemo(
    () => ({
      returns: t('pro.pane.returns', 'Monatsrendite'),
      drawdown: t('pro.pane.drawdown', 'Abstand zum Hoch'),
      entry: t('pro.entry', 'Einstieg'),
      plan: t('pro.planWindow', 'Dein Sparplan'),
      interval: t('pro.interval', '1M'),
      base: t('depot.chart.base', 'heutige Mischung, in Euro, Start = 100'),
      open: t('pro.open', 'E'),
      close: t('pro.close', 'S'),
    }),
    [t],
  )
  const screenshot = () => {
    const canvas = chartRef.current?.screenshot()
    canvas?.toBlob((blob) => {
      if (blob) downloadBlob(blob, `wealthcurve-depot-${new Date().toISOString().slice(0, 10)}.png`)
    }, 'image/png')
  }

  const reiter: readonly { id: DepotTab; label: string }[] = [
    { id: 'breakdown', label: t('depot.page.breakdown', 'Was drinsteckt') },
    { id: 'goals', label: t('depot.page.goals', 'Ziele & Vorschläge') },
    { id: 'whatif', label: t('depot.view.whatif', 'Was-wäre-wenn') },
    { id: 'positions', label: t('depot.page.history', 'Verlauf und Positionen') },
    { id: 'data', label: t('depot.page.data', 'Daten & Quellen') },
  ]

  return (
    <div className="flex min-h-full flex-col gap-px bg-[var(--grid)]">
      <Panel label={t('depot.page.title', 'Mein Depot')} className="shrink-0">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              {haupt
                ? t('depot.head.label', 'Mein Depot · Rendite p. a. über {years} J.', { years: haupt.years })
                : t('depot.page.title', 'Mein Depot')}
            </div>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <span
                className="text-[26px] font-semibold leading-none tracking-tight"
                style={{ color: haupt ? (haupt.returnPa >= 0 ? 'var(--up)' : 'var(--down)') : 'var(--text-primary)' }}
              >
                {haupt ? signedPercent(haupt.returnPa) : '–'}
              </span>
              {depot.value ? (
                <span className="text-sm font-medium text-[var(--text-primary)]">{formatEur(depot.value)}</span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {data.loading
                ? t('depot.loading', 'Lade Kurse und Fondsbestände …')
                : look.dates.length > 0
                  ? t('depot.page.meta', '{count} Positionen · Fondsbestände vom {date}', {
                      count: depot.holdings.length,
                      date: look.dates.join(', '),
                    })
                  : t('depot.page.count', '{count} Positionen', { count: depot.holdings.length })}
            </p>
          </div>
          <div className="grid basis-full grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-5 lg:max-w-3xl lg:flex-1 lg:basis-auto">
            <HeadStat label={t('depot.stat.vol', 'Schwankung p. a.')} value={haupt ? pct(haupt.volPa) : '–'} />
            <HeadStat
              label={t('depot.stat.drawdown', 'Größter Rückgang')}
              value={haupt ? pct(haupt.maxDrawdown) : '–'}
              tone={haupt && haupt.maxDrawdown < 0 ? 'down' : undefined}
            />
            <HeadStat label={t('depot.stat.ratio', 'Rendite je Risiko')} value={haupt?.ratio != null ? formatDecimal(haupt.ratio, 2) : '–'} />
            <HeadStat
              label={t('depot.stat.ter', 'Laufende Kosten (TER)')}
              value={pct(stats.ter, 2)}
              hint={t('depot.stat.terDetail', 'gewichtet, steckt schon in den Kursen')}
            />
            <HeadStat
              label={t('depot.stat.exposure', 'Marktengagement')}
              value={pct(stats.exposure)}
              hint={t('depot.stat.exposureDetail', 'des Depotwerts, Hebel mitgezählt')}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <button
              type="button"
              className={PRIMAER}
              disabled={rendite === null || szenarien >= MAX_SCENARIOS}
              onClick={imSparplan}
              title={t('depot.page.toPlanHint', 'Legt ein Szenario mit der historischen Rendite an – keine Prognose.')}
            >
              {t('depot.page.toPlan', 'Im Sparplan weiterrechnen')}
            </button>
            <button type="button" className={SEKUNDAER} aria-expanded={importOffen} onClick={() => setImportOffen((v) => !v)}>
              <Upload size={13} aria-hidden />
              {t('depot.page.reimport', 'Neu importieren')}
            </button>
            <Menu
              label={t('menu.more', 'Weitere Aktionen')}
              trigger={<MoreHorizontal size={16} aria-hidden />}
              triggerClassName="h-8 w-8"
              items={[
                {
                  id: 'clear',
                  label: t('depot.panel.clear', 'Depot leeren'),
                  icon: <Trash2 size={13} />,
                  danger: true,
                  onSelect: () => setLeerenFragen(true),
                },
              ]}
            />
          </div>
        </div>
        {imp.message || data.noServer ? (
          <div className="space-y-1 border-t border-[var(--grid)] px-4 py-2 text-xs text-[var(--text-secondary)]">
            {imp.message ? <p role="status">{imp.message}</p> : null}
            {data.noServer ? (
              <p>
                {t(
                  'depot.noServer',
                  'Kurse und Fondsbestände brauchen den Server („npm run dev“, „npm run serve“ oder Vercel). Ohne ihn bleiben Kennzahlen und Durchschau leer.',
                )}
              </p>
            ) : null}
          </div>
        ) : null}
      </Panel>

      {importOffen ? (
        <Panel className="shrink-0 p-4">
          <DepotImport imp={imp} gross={false} />
        </Panel>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-px lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <Panel label={t('depot.chart.title', 'Verlauf der heutigen Mischung')} className="flex h-[440px] shrink-0 flex-col">
            <PanelHeader title={t('depot.chart.title', 'Verlauf der heutigen Mischung')}>
              {verlauf ? (
                <>
                  <ToolSegment
                    label={t('pro.scale', 'Skala')}
                    value={skala}
                    onChange={setSkala}
                    options={[
                      { value: 'linear', label: t('pro.scale.linear', 'Lin') },
                      { value: 'log', label: t('pro.scale.log', 'Log') },
                      { value: 'percent', label: '%' },
                    ]}
                  />
                  <ToolDivider />
                  <ToolButton onClick={() => chartRef.current?.fit()} label={t('pro.fit', 'Alles zeigen')}>
                    <ScanSearch size={15} aria-hidden />
                  </ToolButton>
                  <ToolButton onClick={screenshot} label={t('pro.screenshot', 'Chart als Bild speichern')}>
                    <Camera size={15} aria-hidden />
                  </ToolButton>
                </>
              ) : null}
            </PanelHeader>
            <div className="relative min-h-0 flex-1">
              {verlauf ? (
                <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-[var(--surface-2)] opacity-40" />}>
                  <MarketChart
                    ref={chartRef}
                    index={verlauf}
                    name={t('depot.chart.subtitle', '{count} Positionen', { count: depot.holdings.length })}
                    scaleMode={skala}
                    entryTime={null}
                    text={chartText}
                  />
                </Suspense>
              ) : (
                <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-[var(--text-muted)]">
                  {data.loading
                    ? t('depot.loading', 'Lade Kurse und Fondsbestände …')
                    : t(
                        'depot.chart.missing',
                        'Für den Verlauf braucht jede Position ein Kurssymbol mit mindestens einem Jahr Kursen – unter „Daten & Quellen“ ergänzen.',
                      )}
                </p>
              )}
            </div>
          </Panel>

          <Panel label={t('depot.analysis', 'Analyse')} className="flex min-h-[420px] flex-1 flex-col">
            <div role="tablist" aria-label={t('depot.analysis', 'Analyse')} className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-[var(--grid)] [scrollbar-width:none]">
              {reiter.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  id={`depot-tab-${r.id}`}
                  aria-selected={tab === r.id}
                  aria-controls="depot-tabpanel"
                  onClick={() => setTab(r.id)}
                  className={cn(
                    '-mb-px whitespace-nowrap border-b-2 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors',
                    tab === r.id
                      ? 'border-[var(--accent-fill)] text-[var(--text-primary)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div id="depot-tabpanel" role="tabpanel" aria-labelledby={`depot-tab-${tab}`} className="min-w-0 flex-1 p-4">
              {tab === 'breakdown' ? (
                <>
                  <p className="mb-4 text-xs text-[var(--text-secondary)]">
                    {t('depot.page.breakdownHint', 'Alle Positionen bis auf die Einzelaktien in den Fonds aufgeschlüsselt.')}
                  </p>
                  <BreakdownView holdings={depot.holdings} look={look} loading={data.loading} />
                </>
              ) : tab === 'goals' ? (
                <>
                  <p className="mb-4 text-xs text-[var(--text-secondary)]">
                    {t('depot.page.goalsHint', 'Worauf du streuen willst – und was dafür noch fehlt.')}
                  </p>
                  <GoalsView look={look} goals={depot.goals} value={depot.value} loading={data.loading} />
                </>
              ) : tab === 'whatif' ? (
                <WhatIfView
                  holdings={depot.holdings}
                  whatIf={depot.whatIf}
                  stats={stats}
                  look={look}
                  variantStats={variantStats}
                  variantLook={variantLook}
                />
              ) : tab === 'positions' ? (
                <OverviewView holdings={depot.holdings} stats={stats} loading={data.loading} nur="tabellen" />
              ) : (
                <>
                  <p className="mb-4 text-xs text-[var(--text-secondary)]">
                    {t(
                      'depot.page.dataHint',
                      'Kurssymbol (Yahoo) für die Kennzahlen, Durchschau für Länder und Branchen. Änderungen wirken sofort.',
                    )}
                  </p>
                  <HoldingsEditor holdings={depot.holdings} data={data} look={look} />
                  {fehler.length > 0 ? (
                    <p className="mt-3 text-xs text-[var(--text-muted)]">
                      {t('depot.errors', 'Nicht geladen: {list}', {
                        list: fehler.map((e) => `${e.source} (${e.message})`).join('; '),
                      })}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-px lg:w-[340px] lg:shrink-0">
          <Panel label={t('depot.page.risks', 'Auffälligkeiten')} className="lg:flex-1">
            <PanelHeader
              title={
                warnungen > 0
                  ? t('depot.page.risksCount', 'Auffälligkeiten ({count})', { count: warnungen })
                  : t('depot.page.risks', 'Auffälligkeiten')
              }
            />
            <div className="p-3">
              <RisksView flags={flags} />
            </div>
          </Panel>
          <Panel className="p-3">
            <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
              {t(
                'depot.disclaimer',
                'Historische Werte der heutigen Mischung, in Euro, monatlich auf die Anteile zurückgesetzt. Vergangenheit ist keine Vorhersage, und nichts hier ist eine Anlageberatung.',
              )}
            </p>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={leerenFragen}
        title={t('depot.clear.title', 'Depot leeren?')}
        text={t('depot.clear.text', 'Alle Positionen und Was-wäre-wenn-Anteile werden gelöscht. Deine Ziele bleiben.')}
        confirm={t('depot.page.clearConfirm', 'Ja, Depot löschen')}
        cancel={t('depot.page.cancel', 'Abbrechen')}
        onConfirm={() => {
          dispatch(actions.setDepot([]))
          setLeerenFragen(false)
        }}
        onCancel={() => setLeerenFragen(false)}
      />
    </div>
  )
}

/** Mein Depot: leer eine Ablagefläche, gefüllt die Analyse. */
export function DepotPage() {
  const leer = useSelector((s) => s.depot.holdings.length === 0)
  const imp = useDepotImport()
  return leer ? <DepotLeer imp={imp} /> : <DepotUebersicht imp={imp} />
}
