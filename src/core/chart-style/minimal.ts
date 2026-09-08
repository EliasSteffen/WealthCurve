import { defineChartStyle } from './types'

/**
 * Nur die Kurven. Ohne Gitter und Achsenlinien bleibt die Form übrig - der
 * Stil, der im Hochformat-Video am besten funktioniert.
 */
export const minimal = defineChartStyle({
  id: 'minimal',
  label: 'Minimal',
  description: 'Ohne Gitter und Achsen, dicke Kurven.',
  line: { width: 3.5, cap: 'round', curve: 'monotone', jitter: 0 },
  area: { opacity: 0 },
  grid: { show: false, dash: null },
  axis: { show: false, tickLine: false, fontSize: 12 },
  labels: { fontSize: 15, endLabels: 'primary' },
  fontFamily: null,
})
