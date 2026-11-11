/** UTF-8-BOM: ohne ihn öffnet Excel die Datei als ANSI und zerlegt „€" und Umlaute. */
export const CSV_BOM = '﻿'

export function csvFilename(date: Date = new Date()): string {
  // Lokales Datum, nicht UTC: kurz nach Mitternacht stünde sonst „gestern" im Namen.
  const pad = (n: number) => String(n).padStart(2, '0')
  return `wealthcurve-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`
}

export function csvBlob(csv: string): Blob {
  return new Blob([CSV_BOM + csv], { type: 'text/csv;charset=utf-8' })
}

/** Die Objekt-URL wird erst nach Verzögerung freigegeben: ein sofortiges revoke bricht in manchen Browsern den Download ab. */
export function downloadCsv(csv: string, date: Date = new Date()): void {
  const url = URL.createObjectURL(csvBlob(csv))
  const a = document.createElement('a')
  a.href = url
  a.download = csvFilename(date)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
