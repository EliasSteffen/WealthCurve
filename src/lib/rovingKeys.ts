import type { KeyboardEvent } from 'react'

/**
 * Pfeiltasten-Navigation für Radiogruppen und Tab-Leisten (WAI-ARIA).
 *
 * Der Handler sitzt am Container und arbeitet auf dem DOM statt auf einer
 * Optionsliste: so bleiben deaktivierte Einträge automatisch außen vor und
 * die Komponenten müssen keine Refs je Eintrag verwalten. „Auswahl folgt
 * Fokus" wird über click() erreicht - der Eintrag reagiert damit genau wie
 * bei einem Mausklick, ohne zweiten Codepfad.
 *
 * `horizontal`: nur Links/Rechts (Tabs). Sonst zusätzlich Hoch/Runter (Radios).
 */
export function rovingKeyHandler(itemSelector: string, horizontal = false) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const keys = horizontal
      ? ['ArrowLeft', 'ArrowRight', 'Home', 'End']
      : ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Home', 'End']
    if (!keys.includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(`${itemSelector}:not(:disabled)`),
    )
    const current = items.indexOf(e.target as HTMLElement)
    if (current < 0) return
    e.preventDefault()
    let next = current
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + items.length) % items.length
    else next = (current + 1) % items.length
    const target = items[next]
    if (!target) return
    target.focus()
    target.click()
  }
}
