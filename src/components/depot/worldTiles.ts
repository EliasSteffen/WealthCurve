/**
 * Weltkarte als Kachelraster: jedes Land eine Kachel, grob an seinem Platz.
 *
 * Bewusst keine Umrisse: dafür bräuchte es Geodaten als Abhängigkeit, und auf
 * einer echten Karte wären Singapur, Hongkong oder Luxemburg - für ein Depot
 * durchaus bedeutsam - kaum zu treffen. Gleich große Kacheln machen jedes Land
 * gleich gut anklickbar; die Lage reicht, um sich zurechtzufinden.
 *
 * Spalte x (0 = Westen) und Zeile y (0 = Norden). Der Kontinent steht hier für
 * Länder, die die Durchschau nicht kennt (z. B. Russland), damit auch sie im
 * Kontinent-Modus zu ihrer Gruppe gehören.
 */
import type { Continent } from '../../core/depot/lookthrough'

export interface Tile {
  /** ISO-3166-Code, wie die Durchschau ihn als Länderschlüssel führt. */
  readonly code: string
  readonly x: number
  readonly y: number
  readonly continent: Continent
}

const kachel = (code: string, x: number, y: number, continent: Continent): Tile => ({ code, x, y, continent })

export const MAP_COLUMNS = 24
export const MAP_ROWS = 11

export const WORLD_TILES: readonly Tile[] = [
  // Nordamerika
  kachel('CA', 2, 1, 'northAmerica'),
  kachel('US', 2, 2, 'northAmerica'),
  kachel('MX', 2, 3, 'northAmerica'),
  // Südamerika
  kachel('CO', 3, 5, 'southAmerica'),
  kachel('VE', 4, 5, 'southAmerica'),
  kachel('PE', 3, 6, 'southAmerica'),
  kachel('BR', 4, 6, 'southAmerica'),
  kachel('CL', 3, 7, 'southAmerica'),
  kachel('AR', 4, 7, 'southAmerica'),
  kachel('UY', 5, 7, 'southAmerica'),
  // Europa
  kachel('IS', 8, 0, 'europe'),
  kachel('NO', 10, 0, 'europe'),
  kachel('SE', 11, 0, 'europe'),
  kachel('FI', 12, 0, 'europe'),
  kachel('RU', 13, 0, 'europe'),
  kachel('IE', 8, 1, 'europe'),
  kachel('GB', 9, 1, 'europe'),
  kachel('NL', 10, 1, 'europe'),
  kachel('DK', 11, 1, 'europe'),
  kachel('PL', 12, 1, 'europe'),
  kachel('UA', 13, 1, 'europe'),
  kachel('BE', 9, 2, 'europe'),
  kachel('LU', 10, 2, 'europe'),
  kachel('DE', 11, 2, 'europe'),
  kachel('CZ', 12, 2, 'europe'),
  kachel('HU', 13, 2, 'europe'),
  kachel('FR', 9, 3, 'europe'),
  kachel('CH', 10, 3, 'europe'),
  kachel('AT', 11, 3, 'europe'),
  kachel('RO', 12, 3, 'europe'),
  kachel('PT', 8, 4, 'europe'),
  kachel('ES', 9, 4, 'europe'),
  kachel('IT', 11, 4, 'europe'),
  kachel('GR', 12, 4, 'europe'),
  kachel('TR', 13, 4, 'europe'),
  // Afrika
  kachel('MA', 9, 5, 'africa'),
  kachel('EG', 12, 5, 'africa'),
  kachel('NG', 10, 6, 'africa'),
  kachel('KE', 12, 7, 'africa'),
  kachel('ZA', 11, 8, 'africa'),
  // Asien
  kachel('KZ', 16, 3, 'asia'),
  kachel('CN', 19, 3, 'asia'),
  kachel('KR', 21, 3, 'asia'),
  kachel('JP', 22, 3, 'asia'),
  kachel('IR', 15, 4, 'asia'),
  kachel('PK', 16, 4, 'asia'),
  kachel('HK', 20, 4, 'asia'),
  kachel('TW', 21, 4, 'asia'),
  kachel('IL', 13, 5, 'asia'),
  kachel('KW', 14, 5, 'asia'),
  kachel('QA', 15, 5, 'asia'),
  kachel('IN', 17, 5, 'asia'),
  kachel('BD', 18, 5, 'asia'),
  kachel('TH', 19, 5, 'asia'),
  kachel('VN', 20, 5, 'asia'),
  kachel('PH', 21, 5, 'asia'),
  kachel('SA', 14, 6, 'asia'),
  kachel('AE', 15, 6, 'asia'),
  kachel('MY', 19, 6, 'asia'),
  kachel('SG', 19, 7, 'asia'),
  kachel('ID', 20, 7, 'asia'),
  // Ozeanien
  kachel('AU', 21, 9, 'oceania'),
  kachel('NZ', 23, 10, 'oceania'),
]
