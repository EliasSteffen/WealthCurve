/**
 * Erzeugt die Weltkarte der Depot-Ziele aus Natural-Earth-Daten.
 *
 *     npm run worldmap
 *
 * Erzeugt statt zur Laufzeit gerechnet: die Projektion und die Umrisse stehen
 * danach als fertige SVG-Pfade in `src/components/depot/worldMap.generated.ts`.
 * Der Browser lädt so weder d3-geo noch TopoJSON, sondern nur Pfade - und die
 * erst, wenn die Karte zu sehen ist.
 *
 * Länder aus `countries-110m`, Kontinente als Verschmelzung ihrer Länder.
 * Kleine Finanzplätze, die in dieser Auflösung fehlen (Singapur, Hongkong),
 * kommen als Punkt an ihren Schwerpunkt aus `countries-50m`.
 */
import { geoCentroid, geoEqualEarth, geoPath } from 'd3-geo'
import countries from 'i18n-iso-countries'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature, merge } from 'topojson-client'
import type { Feature } from 'geojson'
import type { GeometryCollection, GeometryObject, Topology } from 'topojson-specification'
import { COUNTRIES, type Continent } from '../src/core/depot/lookthrough.ts'

const require = createRequire(import.meta.url)
const welt110 = require('world-atlas/countries-110m.json') as Topology
const welt50 = require('world-atlas/countries-50m.json') as Topology

const BREITE = 960
const ZIEL = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components', 'depot', 'worldMap.generated.ts')

/** Kontinent je Land - für Länder, die die Durchschau nicht kennt. */
const KONTINENTE: Readonly<Record<Continent, string>> = {
  africa:
    'DZ AO BJ BW BF BI CM CF TD CD CG CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MA MZ NA NE NG RW SN SL SO ZA SS SD TZ TG TN UG EH ZM ZW',
  europe:
    'AL AT BY BE BA BG HR CY CZ DK EE FI FR DE GR HU IS IE IT XK LV LT LU MD ME NL MK NO PL PT RO RU RS SK SI ES SE CH UA GB TR',
  asia: 'AF AM AZ BD BT BN KH CN GE IN ID IR IQ IL JP JO KZ KW KG LA LB MY MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TM AE UZ VN YE HK',
  northAmerica: 'BS BZ CA CR CU DO SV GL GT HT HN JM MX NI PA PR TT US',
  southAmerica: 'AR BO BR CL CO EC FK GY PY PE SR UY VE',
  oceania: 'AU FJ NC NZ PG SB VU',
}

/** Gebiete ohne ISO-Nummer in Natural Earth. */
const OHNE_NUMMER: Readonly<Record<string, string>> = {
  Kosovo: 'XK',
  'N. Cyprus': 'CY',
  Somaliland: 'SO',
}

function kontinentVon(code: string): Continent | null {
  const bekannt = Object.values(COUNTRIES).find((c) => c.code === code)
  if (bekannt) return bekannt.continent
  for (const [k, liste] of Object.entries(KONTINENTE) as [Continent, string][]) {
    if (liste.split(' ').includes(code)) return k
  }
  return null
}

interface Land {
  readonly code: string
  readonly name: string
  readonly geometry: GeometryObject
}

/** Ein Land als GeoJSON - `feature` liefert für ein einzelnes Objekt immer ein Feature. */
const alsFeature = (welt: Topology, g: GeometryObject) => feature(welt, g) as Feature

function laender(welt: Topology): Land[] {
  const objekt = welt.objects.countries as GeometryCollection
  return objekt.geometries.flatMap((g) => {
    const name = (g.properties as { name?: string } | undefined)?.name ?? ''
    const code =
      (g.id !== undefined ? countries.numericToAlpha2(String(g.id).padStart(3, '0')) : undefined) ??
      OHNE_NUMMER[name]
    return code ? [{ code, name, geometry: g }] : []
  })
}

const alle110 = laender(welt110).filter((l) => l.code !== 'AQ' && l.code !== 'TF')
const sammlung = {
  type: 'FeatureCollection' as const,
  features: alle110.map((l) => alsFeature(welt110, l.geometry)),
}

// Gleichflächig: Afrika und Südamerika in ihrer wahren Größe neben Europa.
const projektion = geoEqualEarth().fitWidth(BREITE, sammlung)
const pfad = geoPath(projektion).digits(0)
const [[, oben], [, unten]] = pfad.bounds(sammlung)
projektion.translate([projektion.translate()[0], projektion.translate()[1] - oben])
const HOEHE = Math.ceil(unten - oben)

/* Länder - Teilstücke mit gleichem Code (Nordzypern) zusammenfassen. */
const formen = new Map<string, { continent: Continent | null; d: string[] }>()
for (const l of alle110) {
  const d = pfad(alsFeature(welt110, l.geometry))
  if (!d) continue
  const eintrag = formen.get(l.code) ?? { continent: kontinentVon(l.code), d: [] }
  eintrag.d.push(d)
  formen.set(l.code, eintrag)
}

/* Kontinente als verschmolzene Umrisse - ohne innere Grenzen. */
const kontinentFormen = (Object.keys(KONTINENTE) as Continent[]).map((k) => {
  const geos = alle110.filter((l) => kontinentVon(l.code) === k).map((l) => l.geometry)
  const verschmolzen = merge(welt110, geos as Parameters<typeof merge>[1])
  return { continent: k, d: pfad(verschmolzen) ?? '' }
})

/* Kleine Finanzplätze, die in 1:110 Mio. fehlen, als Punkt. */
const vorhanden = new Set(formen.keys())
const gesucht = [...new Set(Object.values(COUNTRIES).map((c) => c.code))].filter((c) => !vorhanden.has(c))
const punkte = laender(welt50)
  .filter((l) => gesucht.includes(l.code))
  .map((l) => {
    const [x, y] = projektion(geoCentroid(alsFeature(welt50, l.geometry))) ?? [0, 0]
    return { code: l.code, continent: kontinentVon(l.code), x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
  })
const fehlen = gesucht.filter((c) => !punkte.some((p) => p.code === c))
if (fehlen.length > 0) {
  console.error(`Ohne Form und Punkt: ${fehlen.join(', ')}`)
  process.exit(1)
}

const text = `/**
 * Weltkarte für die Depot-Ziele - ERZEUGT von \`npm run worldmap\`, nicht von Hand ändern.
 *
 * Natural Earth 1:110 Mio. (world-atlas), Equal-Earth-Projektion, ${BREITE} x ${HOEHE}.
 */
import type { Continent } from '../../core/depot/lookthrough'

export const MAP_WIDTH = ${BREITE}
export const MAP_HEIGHT = ${HOEHE}

export interface MapShape {
  /** ISO-3166-Code wie in der Durchschau. */
  readonly code: string
  readonly continent: Continent | null
  readonly d: string
}

export interface MapDot {
  readonly code: string
  readonly continent: Continent | null
  readonly x: number
  readonly y: number
}

export const MAP_COUNTRIES: readonly MapShape[] = ${JSON.stringify(
  [...formen].map(([code, f]) => ({ code, continent: f.continent, d: f.d.join('') })),
)}

export const MAP_CONTINENTS: readonly { readonly continent: Continent; readonly d: string }[] = ${JSON.stringify(
  kontinentFormen,
)}

export const MAP_DOTS: readonly MapDot[] = ${JSON.stringify(punkte)}
`
writeFileSync(ZIEL, text)
console.log(
  `${formen.size} Länder, ${kontinentFormen.length} Kontinente, ${punkte.length} Punkte (${punkte.map((p) => p.code).join(', ')}) -> ${Math.round(text.length / 1024)} KB`,
)
