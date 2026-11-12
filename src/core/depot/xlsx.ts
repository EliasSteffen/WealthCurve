/**
 * Erstes Tabellenblatt einer .xlsx-Datei als Zeilen aus Text - ohne Bibliothek.
 *
 * Eine .xlsx ist ein ZIP-Archiv mit XML darin. Entpackt wird mit
 * `DecompressionStream`, das Browser und Node mitbringen; das XML ist so
 * gleichförmig, dass reguläre Ausdrücke genügen. Eine Abhängigkeit für das
 * Einlesen von elf Zeilen wäre mehr Angriffsfläche als Nutzen.
 *
 * Gelesen werden nur gespeicherte Werte: Zahlen als Zahl ("0.3981", nicht
 * "39,81 %"), Text als Text. Formeln liefern ihr zuletzt berechnetes Ergebnis.
 */

const EOCD = 0x06054b50
const ZENTRAL = 0x02014b50
const LOKAL = 0x04034b50

interface Eintrag {
  readonly methode: number
  readonly groesse: number
  readonly offset: number
}

/** Inhaltsverzeichnis des ZIP-Archivs: Name -> Lage der Daten. */
function verzeichnis(bytes: Uint8Array): Map<string, Eintrag> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let ende = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD) {
      ende = i
      break
    }
  }
  if (ende === -1) throw new Error('Keine .xlsx-Datei (kein ZIP-Archiv).')

  const anzahl = view.getUint16(ende + 10, true)
  let pos = view.getUint32(ende + 16, true)
  const dekoder = new TextDecoder()
  const eintraege = new Map<string, Eintrag>()
  for (let n = 0; n < anzahl; n++) {
    if (view.getUint32(pos, true) !== ZENTRAL) throw new Error('Beschädigtes ZIP-Verzeichnis.')
    const methode = view.getUint16(pos + 10, true)
    const groesse = view.getUint32(pos + 20, true)
    const nameLaenge = view.getUint16(pos + 28, true)
    const extraLaenge = view.getUint16(pos + 30, true)
    const kommentarLaenge = view.getUint16(pos + 32, true)
    const lokal = view.getUint32(pos + 42, true)
    const name = dekoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLaenge))
    if (view.getUint32(lokal, true) !== LOKAL) throw new Error('Beschädigter ZIP-Eintrag.')
    // Die Daten beginnen hinter dem lokalen Kopf - dessen Felder können andere Längen haben.
    const offset = lokal + 30 + view.getUint16(lokal + 26, true) + view.getUint16(lokal + 28, true)
    eintraege.set(name, { methode, groesse, offset })
    pos += 46 + nameLaenge + extraLaenge + kommentarLaenge
  }
  return eintraege
}

async function entpacken(bytes: Uint8Array, eintrag: Eintrag): Promise<string> {
  const daten = bytes.slice(eintrag.offset, eintrag.offset + eintrag.groesse)
  if (eintrag.methode === 0) return new TextDecoder().decode(daten)
  if (eintrag.methode !== 8) throw new Error(`Unbekannte ZIP-Kompression (${eintrag.methode}).`)
  const strom = new Blob([daten]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new TextDecoder().decode(await new Response(strom).arrayBuffer())
}

const ENTITAETEN: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function text(xml: string): string {
  return xml.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (ganz, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(Number.parseInt(code.slice(2), 16))
    if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)))
    return ENTITAETEN[code] ?? ganz
  })
}

/** Alle <t>-Stücke eines Elements, auch bei Rich Text in mehreren Läufen. */
const textStuecke = (xml: string) =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => text(m[1])).join('')

const attribut = (attrs: string, name: string) =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1]

function spalte(ref: string): number {
  let index = 0
  for (const ch of /^[A-Z]+/.exec(ref)?.[0] ?? '') index = index * 26 + (ch.charCodeAt(0) - 64)
  return index - 1
}

export async function readXlsxRows(bytes: Uint8Array): Promise<string[][]> {
  const eintraege = verzeichnis(bytes)
  const lies = async (pfad: string) => {
    const eintrag = eintraege.get(pfad)
    return eintrag ? entpacken(bytes, eintrag) : null
  }

  // Erstes Blatt in der Reihenfolge der Arbeitsmappe, nicht das erste Archivmitglied.
  const mappe = (await lies('xl/workbook.xml')) ?? ''
  const relId = attribut(/<sheet\b([^>]*)\/?>/.exec(mappe)?.[1] ?? '', 'r:id')
  const rels = (await lies('xl/_rels/workbook.xml.rels')) ?? ''
  const ziel = [...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)]
    .map((m) => m[1])
    .find((a) => attribut(a, 'Id') === relId)
  const zielPfad = ziel ? attribut(ziel, 'Target') : undefined
  const blattPfad = zielPfad
    ? zielPfad.startsWith('/')
      ? zielPfad.slice(1)
      : `xl/${zielPfad}`
    : 'xl/worksheets/sheet1.xml'
  const blatt = await lies(blattPfad)
  if (blatt === null) throw new Error('Kein Tabellenblatt in der Datei.')

  const geteilt = [...((await lies('xl/sharedStrings.xml')) ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
    (m) => textStuecke(m[1]),
  )

  const zeilen: string[][] = []
  for (const zeile of blatt.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const nummer = Number(attribut(zeile[1], 'r') ?? zeilen.length + 1)
    const zellen: string[] = []
    let naechste = 0
    for (const zelle of zeile[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = zelle[1]
      const inhalt = zelle[2] ?? ''
      const ref = attribut(attrs, 'r')
      const index = ref ? spalte(ref) : naechste
      naechste = index + 1
      const typ = attribut(attrs, 't')
      const wert = /<v>([\s\S]*?)<\/v>/.exec(inhalt)?.[1]
      let ausgabe = ''
      if (typ === 's') ausgabe = geteilt[Number(wert)] ?? ''
      else if (typ === 'inlineStr') ausgabe = textStuecke(inhalt)
      else if (typ === 'b') ausgabe = wert === '1' ? 'TRUE' : 'FALSE'
      else if (typ === 'e') ausgabe = ''
      else if (wert !== undefined) ausgabe = text(wert)
      while (zellen.length < index) zellen.push('')
      zellen[index] = ausgabe
    }
    while (zeilen.length < nummer - 1) zeilen.push([])
    zeilen[nummer - 1] = zellen
  }
  return zeilen
}

/** Zeilen als Tabulator-Text - die Form, die `parseDepotText` aus Excel kennt. */
export function rowsToText(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map((c) => c.replace(/[\t\r\n]+/g, ' ').trim()).join('\t')).join('\n')
}
