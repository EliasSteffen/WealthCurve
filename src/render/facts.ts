import type { ModelSettings } from '../core/domain/types'
import type { Projection, ProjectionSummary } from '../core/projection'

/**
 * Die Werte hinter den Platzhaltern im Szenentext.
 *
 * Genau einmal definiert: Browser und MCP-Server pflegten dieselbe Liste je
 * eigenständig und wären beim nächsten Platzhalter auseinandergelaufen. Was sie
 * unterscheidet, ist nur die Formatierung - Intl im Browser, ein eigener
 * Formatierer in Node -, und die kommt deshalb als Parameter herein.
 */
export interface FactFormat {
  readonly eur: (value: number) => string
  readonly percent: (value: number) => string
  readonly years: (value: number) => string
}

/** Die Kennung eines Szenarios im Platzhalter: das erste sichtbare ist `s1`. */
export function scenarioKey(index: number): string {
  return `s${index + 1}`
}

function fuerSzenario(s: ProjectionSummary, fmt: FactFormat): Record<string, string> {
  return {
    name: s.label,
    endkapital: fmt.eur(s.final.balance),
    eingezahlt: fmt.eur(s.final.contributions),
    zinsertrag: fmt.eur(s.final.interest),
    rentenkapital: fmt.eur(s.capitalAtRetirement),
    entnahme: fmt.eur(s.monthlyWithdrawal),
    rate: fmt.eur(s.params.monthlyContribution),
    rendite: fmt.percent(s.params.annualRate),
    reicht: s.depletedAtYear == null ? 'reicht durch' : `bis Jahr ${s.depletedAtYear}`,
  }
}

/**
 * Fertig formatierte Werte, nach Platzhalter-Namen.
 *
 * Jeden Wert gibt es zweimal: ohne Präfix für das erste sichtbare Szenario - so
 * funktionieren vorhandene Texte unverändert - und als `s1.rendite`,
 * `s2.rendite` je Szenario. Ohne die zweite Form nannte `{{rendite}}` bei einem
 * Vergleich stillschweigend nur eine der beiden Renditen, was dem Zuschauer
 * nicht auffallen kann.
 *
 * Die Sammelform `{{renditen}}` steht neben `{{szenarien}}`: beide fassen alle
 * sichtbaren Kurven in einer Zeile zusammen und wachsen von selbst mit.
 */
export function buildFacts(
  projection: Projection,
  model: ModelSettings,
  fmt: FactFormat,
): Record<string, string> {
  const erstes = projection.summaries[0]
  const facts: Record<string, string> = {
    ansparjahre: String(model.accumulationYears),
    jahre: fmt.years(projection.rows.length - 1),
    szenarien: projection.summaries
      .map((s) => `${s.label}: ${fmt.eur(s.final.balance)}`)
      .join(' · '),
    renditen: projection.summaries
      .map((s) => `${s.label}: ${fmt.percent(s.params.annualRate)}`)
      .join(' · '),
  }

  if (erstes) Object.assign(facts, fuerSzenario(erstes, fmt))
  projection.summaries.forEach((s, i) => {
    for (const [k, v] of Object.entries(fuerSzenario(s, fmt))) {
      facts[`${scenarioKey(i)}.${k}`] = v
    }
  })
  return facts
}

/**
 * Welche Platzhalter die Oberfläche vorschlägt.
 *
 * Bei einem einzelnen Szenario wären die Formen mit `s1.` nur Rauschen - sie
 * funktionieren trotzdem, sie stehen nur nicht in der Liste.
 */
export function suggestedFactKeys(
  facts: Readonly<Record<string, string>>,
  scenarioCount: number,
): readonly string[] {
  const keys = Object.keys(facts)
  return scenarioCount > 1 ? keys : keys.filter((k) => !k.includes('.'))
}
