import { Upload } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { depotFlags } from '../../core/depot/flags'
import { computeLookThrough } from '../../core/depot/lookthrough'
import { computeDepotStats, scenarioRate, withWeights } from '../../core/depot/metrics'
import { parseDepotText, productId, withResolvedSymbols, type ParseIssue } from '../../core/depot/parse'
import { PARAMETERS } from '../../core/domain/parameters'
import { MAX_SCENARIOS, actions } from '../../core/state'
import type { DepotHolding } from '../../core/depot/types'
import type { Translate } from '../../i18n'
import { cn } from '../../lib/cn'
import { useT } from '../../react/localeContext'
import { useStore } from '../../react/storeContext'
import { useDispatch, useSelector } from '../../react/useSelector'
import { Card } from '../ui/Card'
import { DEPOT_DATEITYPEN, readDepotFile } from './depotFile'
import { pct } from './depotFormat'
import { BreakdownView, OverviewView, RisksView, WhatIfView } from './DepotViews'
import { GoalsView } from './GoalsView'
import { HoldingsEditor } from './HoldingsEditor'
import { notYetResolved, resolveSymbols } from './resolveSymbols'
import { useDepotData } from './useDepotData'

const PRIMAER =
  'rounded-lg bg-[var(--accent-fill)] px-3 py-1.5 text-sm font-medium text-[var(--on-accent)] hover:opacity-90 disabled:opacity-40'
const SEKUNDAER =
  'rounded-lg border border-[var(--hairline)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--grid)] disabled:opacity-40'

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
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 text-center transition-colors',
          gross ? 'py-12' : 'py-6',
          darueber ? 'border-[var(--chart-1)] bg-[var(--grid)]' : 'border-[var(--hairline)]',
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
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-1)] p-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--chart-1)] focus:outline-none"
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

function Abschnitt({
  title,
  hint,
  children,
}: {
  readonly title: string
  readonly hint?: string
  readonly children: ReactNode
}) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
      {hint ? <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </Card>
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

function DepotUebersicht({ imp }: { readonly imp: Import }) {
  const t = useT()
  const dispatch = useDispatch()
  const depot = useSelector((s) => s.depot)
  const szenarien = useSelector((s) => s.scenarios.length)
  const data = useDepotData(depot.holdings)
  useDepotReparatur(depot.holdings)
  const [importOffen, setImportOffen] = useState(false)
  const [alleRisiken, setAlleRisiken] = useState(false)
  const [leerenFragen, setLeerenFragen] = useState(false)

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
  // Ein fehlender Fondsbestand ist kein Fehler, wenn die Position anders zerlegt wurde.
  const fehler = data.errors.filter(
    (e) =>
      !depot.holdings.some(
        (h) => h.lookThrough.startsWith(e.source) && (look.sources[h.id]?.kind ?? 'none') !== 'none',
      ),
  )

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

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">{t('depot.page.title', 'Mein Depot')}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMAER}
            disabled={rendite === null || szenarien >= MAX_SCENARIOS}
            onClick={imSparplan}
            title={t('depot.page.toPlanHint', 'Legt ein Szenario mit der historischen Rendite an – keine Prognose.')}
          >
            {t('depot.page.toPlan', 'Im Sparplan weiterrechnen')}
          </button>
          <button
            type="button"
            className={SEKUNDAER}
            aria-expanded={importOffen}
            onClick={() => setImportOffen((v) => !v)}
          >
            {t('depot.page.reimport', 'Neu importieren')}
          </button>
          {leerenFragen ? (
            <>
              <button
                type="button"
                className={SEKUNDAER}
                onClick={() => {
                  dispatch(actions.setDepot([]))
                  setLeerenFragen(false)
                }}
              >
                {t('depot.page.clearConfirm', 'Ja, Depot löschen')}
              </button>
              <button type="button" className={SEKUNDAER} onClick={() => setLeerenFragen(false)}>
                {t('depot.page.cancel', 'Abbrechen')}
              </button>
            </>
          ) : (
            <button type="button" className={SEKUNDAER} onClick={() => setLeerenFragen(true)}>
              {t('depot.panel.clear', 'Depot leeren')}
            </button>
          )}
        </div>
      </div>

      {imp.message ? (
        <p role="status" className="text-sm text-[var(--text-secondary)]">
          {imp.message}
        </p>
      ) : null}
      {importOffen ? (
        <Card>
          <DepotImport imp={imp} gross={false} />
        </Card>
      ) : null}
      {data.noServer ? (
        <p className="rounded-lg border border-[var(--hairline)] p-3 text-sm text-[var(--text-secondary)]">
          {t(
            'depot.noServer',
            'Kurse und Fondsbestände brauchen den Server („npm run dev“, „npm run serve“ oder Vercel). Ohne ihn bleiben Kennzahlen und Durchschau leer.',
          )}
        </p>
      ) : null}

      <Card>
        <OverviewView holdings={depot.holdings} stats={stats} loading={data.loading} nur="kacheln" />
      </Card>

      <Abschnitt
        title={
          warnungen > 0
            ? t('depot.page.risksCount', 'Auffälligkeiten ({count})', { count: warnungen })
            : t('depot.page.risks', 'Auffälligkeiten')
        }
      >
        <RisksView flags={flags} limit={alleRisiken ? undefined : 3} />
        {!alleRisiken && flags.length > 3 ? (
          <button type="button" className={cn(SEKUNDAER, 'mt-3')} onClick={() => setAlleRisiken(true)}>
            {t('depot.page.allRisks', 'Alle {count} anzeigen', { count: flags.length })}
          </button>
        ) : null}
      </Abschnitt>

      <Abschnitt
        title={t('depot.page.breakdown', 'Was drinsteckt')}
        hint={t('depot.page.breakdownHint', 'Alle Positionen bis auf die Einzelaktien in den Fonds aufgeschlüsselt.')}
      >
        <BreakdownView holdings={depot.holdings} look={look} loading={data.loading} />
      </Abschnitt>

      <Abschnitt
        title={t('depot.page.goals', 'Ziele & Vorschläge')}
        hint={t('depot.page.goalsHint', 'Worauf du streuen willst – und was dafür noch fehlt.')}
      >
        <GoalsView look={look} goals={depot.goals} value={depot.value} loading={data.loading} />
      </Abschnitt>

      <Abschnitt title={t('depot.page.history', 'Verlauf und Positionen')}>
        <OverviewView holdings={depot.holdings} stats={stats} loading={data.loading} nur="tabellen" />
      </Abschnitt>

      <Abschnitt title={t('depot.view.whatif', 'Was-wäre-wenn')}>
        <WhatIfView
          holdings={depot.holdings}
          whatIf={depot.whatIf}
          stats={stats}
          look={look}
          variantStats={variantStats}
          variantLook={variantLook}
        />
      </Abschnitt>

      <Abschnitt
        title={t('depot.page.data', 'Daten & Quellen')}
        hint={t(
          'depot.page.dataHint',
          'Kurssymbol (Yahoo) für die Kennzahlen, Durchschau für Länder und Branchen. Änderungen wirken sofort.',
        )}
      >
        <HoldingsEditor holdings={depot.holdings} data={data} look={look} />
        {fehler.length > 0 ? (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            {t('depot.errors', 'Nicht geladen: {list}', {
              list: fehler.map((e) => `${e.source} (${e.message})`).join('; '),
            })}
          </p>
        ) : null}
      </Abschnitt>

      <p className="text-xs text-[var(--text-muted)]">
        {t(
          'depot.disclaimer',
          'Historische Werte der heutigen Mischung, in Euro, monatlich auf die Anteile zurückgesetzt. Vergangenheit ist keine Vorhersage, und nichts hier ist eine Anlageberatung.',
        )}
      </p>
    </div>
  )
}

/** Mein Depot: leer eine Ablagefläche, gefüllt die Analyse. */
export function DepotPage() {
  const leer = useSelector((s) => s.depot.holdings.length === 0)
  const imp = useDepotImport()
  return leer ? <DepotLeer imp={imp} /> : <DepotUebersicht imp={imp} />
}
