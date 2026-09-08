import { defineChartStyle } from './types'

/** Gleiche Geometrie wie der Standard, aber aus zehn Metern Entfernung lesbar. */
export const presentation = defineChartStyle({
  id: 'presentation',
  label: 'Präsentation',
  description: 'Größere Schrift für Beamer und Screenshots.',
  line: { width: 3, cap: 'round', curve: 'monotone', jitter: 0 },
  area: { opacity: 0 },
  grid: { show: true, dash: null },
  axis: { show: true, tickLine: false, fontSize: 15 },
  labels: { fontSize: 16, endLabels: 'primary' },
  fontFamily: null,
})
