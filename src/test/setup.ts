import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import React from 'react'

/*
 * Recharts' ResponsiveContainer misst seinen Parent - in jsdom ist der 0x0,
 * also rendert der Chart nichts und jede Assertion scheitert ohne erkennbaren
 * Grund. Ein fix dimensionierter Container macht Chart-Tests überhaupt möglich.
 */
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { style: { width: 800, height: 400 } }, children),
  }
})
