import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { NumberField } from '@/components/ui/NumberField'
import { MAX_START_YEAR, MIN_START_YEAR, sanitizeStartYear } from '@/core/timeAxis'

/**
 * Ein Feld mit Untergrenze am Startjahr.
 *
 * Der Aufbau bildet die App nach: die Komponente reicht nach oben, oben wird
 * geklemmt, und der geklemmte Wert kommt zurück. Genau in dieser Schleife saß
 * der Fehler - ohne die Klemmung würde der Test nichts beweisen.
 */
function Feld({ start = null }: { readonly start?: number | null }) {
  const [wert, setWert] = useState<number | null>(start)
  return (
    <>
      <NumberField
        label="Startjahr"
        value={wert}
        min={MIN_START_YEAR}
        max={MAX_START_YEAR}
        placeholder="ohne"
        onChange={(v) => setWert(sanitizeStartYear(v))}
      />
      <output data-testid="wert">{wert === null ? 'null' : String(wert)}</output>
    </>
  )
}

describe('NumberField', () => {
  it('lässt ein Jahr Ziffer für Ziffer eintippen', async () => {
    // Die Regression: jeder Tastendruck wurde sofort geklemmt, „1" wurde zu
    // 1900 und „19009" zu 2100 - eintippbar waren nur diese beiden Werte.
    const user = userEvent.setup()
    render(<Feld />)
    await user.type(screen.getByLabelText('Startjahr'), '1990')
    expect(screen.getByLabelText('Startjahr')).toHaveValue(1990)
    await user.tab()
    expect(screen.getByTestId('wert')).toHaveTextContent('1990')
  })

  it('klemmt erst beim Verlassen', async () => {
    const user = userEvent.setup()
    render(<Feld />)
    await user.type(screen.getByLabelText('Startjahr'), '1500')
    expect(screen.getByTestId('wert')).toHaveTextContent('null')
    await user.tab()
    expect(screen.getByTestId('wert')).toHaveTextContent('1900')
  })

  it('übernimmt mit Enter', async () => {
    const user = userEvent.setup()
    render(<Feld />)
    await user.type(screen.getByLabelText('Startjahr'), '2010{Enter}')
    expect(screen.getByTestId('wert')).toHaveTextContent('2010')
  })

  it('macht aus einem geleerten Feld „nicht gesetzt", nicht 0', async () => {
    const user = userEvent.setup()
    render(<Feld start={1990} />)
    await user.clear(screen.getByLabelText('Startjahr'))
    await user.tab()
    expect(screen.getByTestId('wert')).toHaveTextContent('null')
  })

  it('zeigt nach dem Verlassen wieder den Wert aus dem Zustand', async () => {
    // Der Entwurfstext darf nicht kleben bleiben: sonst stünde im Feld 1500,
    // während mit 1900 gerechnet wird.
    const user = userEvent.setup()
    render(<Feld />)
    await user.type(screen.getByLabelText('Startjahr'), '1500')
    await user.tab()
    expect(screen.getByLabelText('Startjahr')).toHaveValue(1900)
  })
})
