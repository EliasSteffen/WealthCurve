import { defineChartStyle } from './types'

/** Der Standard: dünne Linien, zurückhaltendes Gitter, nichts drängt sich vor. */
export const clean = defineChartStyle({
  id: 'clean',
  label: 'Klar',
  description: 'Dünne Linien, feines Gitter, ruhige Achsen.',
  line: { width: 2, cap: 'round', curve: 'monotone', jitter: 0 },
  area: { opacity: 0 },
  grid: { show: true, dash: null },
  axis: { show: true, tickLine: false, fontSize: 11 },
  labels: { fontSize: 11, endLabels: 'primary' },
  fontFamily: null,
})
