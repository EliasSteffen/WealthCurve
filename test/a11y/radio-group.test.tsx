import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { LocaleToggle } from '@/components/LocaleToggle'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { ThemePreference } from '@/hooks/useTheme'
import { LocaleProvider } from '@/react/LocaleProvider'

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', disabled: true },
  { value: 'c', label: 'Gamma' },
  { value: 'd', label: 'Delta' },
] as const

function Seg({ start = 'a' }: { start?: string }) {
  const [v, setV] = useState(start)
  return (
    <>
      <button>davor</button>
      <SegmentedControl label="Auswahl" value={v} options={OPTIONS} onChange={setV} />
      <button>danach</button>
    </>
  )
}

const radio = (name: string) => screen.getByRole('radio', { name })

describe('SegmentedControl als Radiogruppe', () => {
  it('hat benannte Gruppe und nur einen Tab-Stopp', async () => {
    render(<Seg />)
    expect(screen.getByRole('radiogroup', { name: 'Auswahl' })).toBeInTheDocument()
    expect(radio('Alpha')).toHaveAttribute('tabindex', '0')
    expect(radio('Gamma')).toHaveAttribute('tabindex', '-1')
    const user = userEvent.setup()
    await user.tab()
    await user.tab()
    expect(radio('Alpha')).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'danach' })).toHaveFocus()
  })

  it('Pfeile wählen, folgen mit Fokus, überspringen Deaktiviertes und wrappen', async () => {
    const user = userEvent.setup()
    render(<Seg />)
    radio('Alpha').focus()
    await user.keyboard('{ArrowRight}')
    expect(radio('Gamma')).toHaveFocus()
    expect(radio('Gamma')).toHaveAttribute('aria-checked', 'true')
    expect(radio('Gamma')).toHaveAttribute('tabindex', '0')
    expect(radio('Alpha')).toHaveAttribute('tabindex', '-1')
    await user.keyboard('{ArrowDown}')
    expect(radio('Delta')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{ArrowRight}')
    expect(radio('Alpha')).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(radio('Delta')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(radio('Gamma')).toHaveFocus()
  })

  it('Home und End springen an die Enden', async () => {
    const user = userEvent.setup()
    render(<Seg start="c" />)
    radio('Gamma').focus()
    await user.keyboard('{End}')
    expect(radio('Delta')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{Home}')
    expect(radio('Alpha')).toHaveAttribute('aria-checked', 'true')
    expect(radio('Alpha')).toHaveFocus()
  })
})

describe('LocaleToggle und ThemeToggle', () => {
  function Themes() {
    const [t, setT] = useState<ThemePreference>('light')
    return <ThemeToggle theme={t} onChange={setT} />
  }

  it('ThemeToggle: roving tabindex und Pfeile', async () => {
    const user = userEvent.setup()
    render(
      <LocaleProvider>
        <Themes />
      </LocaleProvider>,
    )
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1'])
    radios[0]!.focus()
    await user.keyboard('{ArrowLeft}')
    expect(radios[2]).toHaveFocus()
    expect(radios[2]).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{Home}')
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
  })

  it('LocaleToggle: Pfeile wechseln die Sprache', async () => {
    localStorage.clear()
    const user = userEvent.setup()
    render(
      <LocaleProvider>
        <LocaleToggle />
      </LocaleProvider>,
    )
    const radios = screen.getAllByRole('radio')
    expect(radios.filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1)
    const checked = radios.find((r) => r.getAttribute('aria-checked') === 'true')!
    checked.focus()
    await user.keyboard('{ArrowRight}')
    const now = screen.getAllByRole('radio').find((r) => r.getAttribute('aria-checked') === 'true')!
    expect(now).not.toBe(checked)
    expect(now).toHaveFocus()
    localStorage.clear()
  })
})
