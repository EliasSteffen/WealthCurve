import { CHART_STYLES } from '../../core/chart-style'
import { WITHDRAWAL_STRATEGIES } from '../../core/domain/withdrawal'
import type { SettingsEntry } from '../../core/settings'
import type { Translate } from '../../i18n'

/**
 * Suchtext eines Eintrags in der aktiven Sprache.
 *
 * Der Suchindex im Kern ist deutsch (er läuft auch ohne Oberfläche). Wer auf
 * Englisch „Initial capital“ tippt, fände dort nichts - also reicht die
 * Oberfläche dieselben Schlüssel nach, die sie auch zum Beschriften benutzt.
 * Fehlt eine Übersetzung, ergibt `t(…, '')` einen leeren Text und der Eintrag
 * bleibt über seine deutschen Wörter auffindbar.
 */
export function translatedSearchText(entry: SettingsEntry, t: Translate): readonly string[] {
  const [art, name] = entry.id.split(':')
  const text = (key: string) => t(key, '')

  if (art === 'param' || art === 'timeline') {
    return [text(`${art}.${name}.label`), text(`${art}.${name}.hint`)]
  }
  if (art === 'series') {
    return [text(`series.${name}.label`), text(`series.${name}.description`)]
  }

  // Stil und Entnahmeregel haben je Variante einen Eintrag unter derselben ID.
  const stil = CHART_STYLES.find((s) => s.label === entry.label)
  if (entry.id === 'style' && stil) {
    return [text(`style.${stil.id}.label`), text(`style.${stil.id}.description`)]
  }
  const regel = WITHDRAWAL_STRATEGIES.find((s) => s.label === entry.label)
  if (entry.id === 'model:withdrawalRule' && regel) {
    return [text(`withdrawal.${regel.id}.label`), text(`withdrawal.${regel.id}.description`)]
  }

  const basis = `settings.index.${entry.id.replace(':', '.')}`
  return [text(`${basis}.label`), text(`${basis}.keywords`)]
}
