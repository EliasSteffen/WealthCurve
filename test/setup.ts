import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Die Charts zeichnen auf Canvas, das jsdom nicht hat - siehe test/lwcMock.ts.
vi.mock('lightweight-charts', async () => (await import('./lwcMock')).lightweightChartsMock)

/*
 * jsdom kennt showModal und close nicht überall. Ohne sie bliebe jeder native
 * Dialog (Befehlspalette, Rückfragen) stumm geschlossen.
 */
// Nur unter jsdom - Server-Tests laufen in reinem Node ohne DOM.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}
