/**
 * Beschriftung und Zahlenformat der Depot-Analyse.
 *
 * Der Kern liefert Schlüssel ("US", "it", "mega", "etf|2"), die Oberfläche
 * macht daraus Text in der gewählten Sprache. Ländernamen kommen aus
 * Intl.DisplayNames - 35 Länder von Hand zu übersetzen wäre Pflege ohne Nutzen.
 */
import { currentFormatterLocale } from '../../lib/format'
import type { Translate } from '../../i18n'

export function pct(value: number, digits = 1): string {
  return new Intl.NumberFormat(currentFormatterLocale(), {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function ratio(value: number | null): string {
  if (value === null) return '–'
  return new Intl.NumberFormat(currentFormatterLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export type Dimension =
  | 'asset'
  | 'continent'
  | 'market'
  | 'country'
  | 'sector'
  | 'size'
  | 'currency'
  | 'product'

export function specialLabel(key: string, t: Translate): string | null {
  switch (key) {
    case 'commodity':
      return t('depot.key.commodity', 'Rohstoffe')
    case 'cash':
      return t('depot.key.cash', 'Barmittel & Derivate')
    case 'unknown':
      return t('depot.key.unknown', 'Unbekannt')
    case 'financing':
      return t('depot.key.financing', 'Hebel-Finanzierung')
    default:
      return null
  }
}

function countryLabel(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code
  try {
    return new Intl.DisplayNames([currentFormatterLocale()], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

export function kindLabel(kind: string, t: Translate): string {
  switch (kind) {
    case 'etf':
      return t('depot.kind.etf', 'ETF')
    case 'stock':
      return t('depot.kind.stock', 'Einzelaktie')
    case 'etc':
      return t('depot.kind.etc', 'ETC')
    default:
      return kind
  }
}

export function shareLabel(dimension: Dimension, key: string, t: Translate): string {
  const special = specialLabel(key, t)
  if (special) return special
  switch (dimension) {
    case 'asset':
      return key === 'equity' ? t('depot.asset.equity', 'Aktien') : key
    case 'continent':
      return (
        {
          northAmerica: t('depot.continent.northAmerica', 'Nordamerika'),
          southAmerica: t('depot.continent.southAmerica', 'Südamerika'),
          europe: t('depot.continent.europe', 'Europa'),
          asia: t('depot.continent.asia', 'Asien'),
          oceania: t('depot.continent.oceania', 'Ozeanien'),
          africa: t('depot.continent.africa', 'Afrika'),
        }[key] ?? key
      )
    case 'market':
      return key === 'developed'
        ? t('depot.market.developed', 'Industrieländer')
        : key === 'emerging'
          ? t('depot.market.emerging', 'Schwellenländer')
          : key
    case 'country':
      return countryLabel(key)
    case 'sector':
      return (
        {
          it: t('depot.sector.it', 'IT'),
          financials: t('depot.sector.financials', 'Finanzen'),
          industrials: t('depot.sector.industrials', 'Industrie'),
          healthCare: t('depot.sector.healthCare', 'Gesundheit'),
          consumerDiscretionary: t('depot.sector.consumerDiscretionary', 'Zyklischer Konsum'),
          communication: t('depot.sector.communication', 'Kommunikation'),
          consumerStaples: t('depot.sector.consumerStaples', 'Basiskonsum'),
          energy: t('depot.sector.energy', 'Energie'),
          materials: t('depot.sector.materials', 'Grundstoffe'),
          utilities: t('depot.sector.utilities', 'Versorger'),
          realEstate: t('depot.sector.realEstate', 'Immobilien'),
        }[key] ?? key
      )
    case 'size':
      return (
        {
          mega: t('depot.size.mega', 'Mega (> 200 Mrd. USD)'),
          large: t('depot.size.large', 'Large (10–200 Mrd.)'),
          mid: t('depot.size.mid', 'Mid (2–10 Mrd.)'),
          small: t('depot.size.small', 'Small (< 2 Mrd.)'),
        }[key] ?? key
      )
    case 'product': {
      const [kind = '', lev = '1'] = key.split('|')
      return Number(lev) > 1
        ? t('depot.kind.leveraged', '{kind} mit {lev}×-Hebel', { kind: kindLabel(kind, t), lev })
        : kindLabel(kind, t)
    }
    case 'currency':
      return key
  }
}
