import { useEffect, useState } from 'react'

/**
 * Eine Vorliebe der Ansicht im Browser merken - Skala, offene Tabelle, gewählter Reiter.
 *
 * Komfort, kein Muss: jeder Zugriff darf scheitern (privater Modus, volle
 * Quota), dann gilt die Wahl eben nur für diese Sitzung. Was gelesen wird, muss
 * `valid` bestehen - alte oder fremde Werte fallen auf die Vorgabe zurück.
 */
export function useStoredState<T>(key: string, fallback: T, valid: (v: unknown) => v is T) {
  const voll = `wealthcurve.ui.${key}`
  const [wert, setWert] = useState<T>(() => {
    try {
      const roh = localStorage.getItem(voll)
      const gelesen: unknown = roh === null ? undefined : JSON.parse(roh)
      return valid(gelesen) ? gelesen : fallback
    } catch {
      return fallback
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(voll, JSON.stringify(wert))
    } catch {
      /* privat oder voll - die Wahl gilt für diese Sitzung */
    }
  }, [voll, wert])
  return [wert, setWert] as const
}
