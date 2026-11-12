// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseDepotText } from '../../../src/core/depot/parse'
import { readXlsxRows, rowsToText } from '../../../src/core/depot/xlsx'

const enc = new TextEncoder()

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const strom = new Blob([bytes.slice()]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(strom).arrayBuffer())
}

/** Minimales ZIP - genug für den Leser, der keine Prüfsummen auswertet. */
async function zip(files: Record<string, string>, komprimiert: boolean): Promise<Uint8Array> {
  const teile: Uint8Array[] = []
  const zentral: Uint8Array[] = []
  let offset = 0
  for (const [name, inhalt] of Object.entries(files)) {
    const n = enc.encode(name)
    const roh = enc.encode(inhalt)
    const daten = komprimiert ? await deflate(roh) : roh
    const lokal = new DataView(new ArrayBuffer(30))
    lokal.setUint32(0, 0x04034b50, true)
    lokal.setUint16(8, komprimiert ? 8 : 0, true)
    lokal.setUint32(18, daten.length, true)
    lokal.setUint32(22, roh.length, true)
    lokal.setUint16(26, n.length, true)
    const z = new DataView(new ArrayBuffer(46))
    z.setUint32(0, 0x02014b50, true)
    z.setUint16(10, komprimiert ? 8 : 0, true)
    z.setUint32(20, daten.length, true)
    z.setUint32(24, roh.length, true)
    z.setUint16(28, n.length, true)
    z.setUint32(42, offset, true)
    teile.push(new Uint8Array(lokal.buffer), n, daten)
    zentral.push(new Uint8Array(z.buffer), n)
    offset += 30 + n.length + daten.length
  }
  const groesse = zentral.reduce((s, b) => s + b.length, 0)
  const ende = new DataView(new ArrayBuffer(22))
  ende.setUint32(0, 0x06054b50, true)
  ende.setUint16(8, Object.keys(files).length, true)
  ende.setUint16(10, Object.keys(files).length, true)
  ende.setUint32(12, groesse, true)
  ende.setUint32(16, offset, true)
  const alles = [...teile, ...zentral, new Uint8Array(ende.buffer)]
  const out = new Uint8Array(alles.reduce((s, b) => s + b.length, 0))
  let pos = 0
  for (const b of alles) {
    out.set(b, pos)
    pos += b.length
  }
  return out
}

const MAPPE = {
  // Bewusst nicht "sheet1.xml": der Leser muss den Weg über die Beziehungen gehen.
  'xl/workbook.xml': '<workbook><sheets><sheet name="Depot" sheetId="1" r:id="rId7"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':
    '<Relationships><Relationship Id="rId7" Type="worksheet" Target="worksheets/blatt.xml"/></Relationships>',
  'xl/sharedStrings.xml':
    '<sst><si><t>WKN</t></si><si><t>Anteil</t></si><si><r><t>Apple </t></r><r><t>&amp; Co</t></r></si><si><t>Summe</t></si></sst>',
  'xl/worksheets/blatt.xml': [
    '<worksheet><sheetData>',
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>Name</t></is></c></row>',
    '<row r="2"><c r="A2" t="inlineStr"><is><t>X1</t></is></c><c r="B2"><v>0.6</v></c><c r="C2" t="s"><v>2</v></c></row>',
    '<row r="3"><c r="A3" t="str"><v>X2</v></c><c r="B3" s="1"><v>0.4</v></c></row>',
    '<row r="5"><c r="A5" t="s"><v>3</v></c><c r="B5"><v>1</v></c><c r="D5"/></row>',
    '</sheetData></worksheet>',
  ].join(''),
}

describe('readXlsxRows', () => {
  it.each([
    ['gespeichert', false],
    ['komprimiert', true],
  ])('liest das erste Blatt (%s)', async (_, komprimiert) => {
    const rows = await readXlsxRows(await zip(MAPPE, komprimiert))
    expect(rows).toEqual([
      ['WKN', 'Anteil', 'Name'],
      ['X1', '0.6', 'Apple & Co'],
      ['X2', '0.4'],
      [],
      ['Summe', '1', '', ''],
    ])
    const { holdings, issues } = parseDepotText(rowsToText(rows))
    expect(issues).toEqual([])
    expect(holdings.map((h) => [h.id, h.weight, h.name])).toEqual([
      ['X1', 0.6, 'Apple & Co'],
      ['X2', 0.4, 'X2'],
    ])
  })

  it('lehnt Dateien ab, die kein ZIP sind', async () => {
    await expect(readXlsxRows(enc.encode('WKN;Anteil\nA;1'))).rejects.toThrow(/ZIP/)
  })
})
