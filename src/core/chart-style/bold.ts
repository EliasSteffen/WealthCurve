import { defineChartStyle } from './types.ts'

/**
 * Mit Fläche unter der Kurve. Der Abstand zwischen Zinseszins und Eingezahltem
 * wird dadurch als Fläche sichtbar statt nur als Lücke zwischen zwei Linien.
 */
export const bold = defineChartStyle({
  id: 'bold',
  label: 'Kräftig',
  description: 'Dicke Linien mit Farbfläche darunter.',
  line: { width: 3, cap: 'round', curve: 'monotone', jitter: 0 },
  area: { opacity: 0.14 },
  grid: { show: true, dash: null },
  axis: { show: true, tickLine: false, fontSize: 12 },
  labels: { fontSize: 12, endLabels: 'primary' },
  fontFamily: null,
})
