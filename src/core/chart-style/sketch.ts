import { defineChartStyle } from './types.ts'

/**
 * Handgezeichnet: Linien und Gitter wackeln leicht, Beschriftung in
 * Handschrift. Der Versatz wird deterministisch berechnet (siehe
 * src/render/wobble.ts), damit die Kurve im Video nicht flimmert.
 */
export const sketch = defineChartStyle({
  id: 'sketch',
  label: 'Gezeichnet',
  description: 'Wie mit der Hand skizziert.',
  line: { width: 2.5, cap: 'round', curve: 'linear', jitter: 2.2 },
  area: { opacity: 0 },
  grid: { show: true, dash: '5 7' },
  axis: { show: true, tickLine: false, fontSize: 13 },
  labels: { fontSize: 14, endLabels: 'primary' },
  fontFamily: '"Caveat", "Comic Sans MS", cursive',
})
