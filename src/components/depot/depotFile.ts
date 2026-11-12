/**
 * Eine hochgeladene Depot-Datei als Tabellentext lesen.
 *
 * .xlsx über den eigenen Leser im Kern, alles Textförmige (CSV, TSV, Broker-
 * Exporte) direkt. Alte .xls-, .numbers- und .ods-Dateien sind andere Formate -
 * besser eine klare Absage als ein falsch gelesenes Depot.
 */
import { readXlsxRows, rowsToText } from '../../core/depot/xlsx'

export const DEPOT_DATEITYPEN =
  '.xlsx,.xlsm,.csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function readDepotFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (/\.(xls|numbers|ods)$/.test(name)) throw new Error(`Nicht unterstütztes Format: ${file.name}`)
  if (/\.(xlsx|xlsm)$/.test(name) || file.type.includes('spreadsheetml')) {
    return rowsToText(await readXlsxRows(new Uint8Array(await file.arrayBuffer())))
  }
  return file.text()
}
