/**
 * Zu einer Einstellung springen: sichtbar machen, kurz hervorheben, Fokus hinein.
 *
 * Ein aufklappbarer Abschnitt (<details>) wird dabei geöffnet. Gesucht wird nach
 * ID oder nach `data-setting` - so finden Befehlspalette und Querverweise jedes
 * Eingabefeld, ohne seine interne ID zu kennen.
 */
/**
 * Nur den nächsten scrollbaren Vorfahren bewegen.
 *
 * `scrollIntoView` scrollt jeden Vorfahren, auch einen mit `overflow: hidden` -
 * auf großen Schirmen schob das die ganze Arbeitsfläche samt Kopfzeile aus dem
 * Bild. Hier rückt nur die Spalte, in der das Feld steht.
 */
function scrollInto(el: HTMLElement): void {
  let box = el.parentElement
  while (box) {
    const { overflowY } = getComputedStyle(box)
    if ((overflowY === 'auto' || overflowY === 'scroll') && box.scrollHeight > box.clientHeight) break
    box = box.parentElement
  }
  if (!box) return
  const oben = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
  const ziel = oben - (box.clientHeight - Math.min(el.offsetHeight, box.clientHeight)) / 2
  box.scrollTo?.({ top: Math.max(0, ziel), behavior: 'smooth' })
}

export function revealSetting(ziel: string): boolean {
  const el =
    document.getElementById(ziel) ?? document.querySelector<HTMLElement>(`[data-setting="${CSS.escape(ziel)}"]`)
  if (!el) return false
  if (el instanceof HTMLDetailsElement) el.open = true
  el.closest('details')?.setAttribute('open', '')
  scrollInto(el)
  el.classList.remove('reveal-flash')
  // Erzwingt einen neuen Layout-Durchlauf, damit die Animation erneut startet.
  void el.offsetWidth
  el.classList.add('reveal-flash')
  const feld = el.querySelector<HTMLElement>(
    'input:not([type=hidden]):not([type=file]):not(:disabled), select, textarea, button:not(:disabled), summary',
  )
  ;(feld ?? el).focus({ preventScroll: true })
  return true
}
