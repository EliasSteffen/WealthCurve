import type { Catalog } from './types'

/**
 * Englische Übersetzungen.
 *
 * Nur Abweichungen vom deutschen Original - fehlt ein Schlüssel, bleibt der
 * deutsche Text stehen. Das ist Absicht: eine Lücke zeigt lesbaren Text statt
 * eines rohen Schlüssels, und eine neue Serie funktioniert sofort in beiden
 * Sprachen, sie ist nur noch nicht übersetzt.
 */
export const en: Catalog = {
  // Kopfbereich
  'app.title': 'Compound interest',
  'app.subtitle': 'How rate, return and time shape your wealth.',
  'app.reset': 'Reset',
  'app.video': 'Video',

  // Kategorien
  'settings.view.kompakt': 'Compact',
  'settings.view.alles': 'All',
  'settings.view': 'View',
  'settings.search': 'Search settings …',
  'settings.clearSearch': 'Clear search',
  'settings.empty': 'Nothing found for “{query}”.',
  'settings.open': 'Show settings',
  'settings.close': 'Hide settings',
  'category.szenarien.label': 'Scenarios',
  'category.szenarien.hint': 'Create, compare, show and hide',
  'category.kapital.label': 'Capital',
  'category.kapital.hint': 'Return and starting capital',
  'category.einzahlung.label': 'Contributions',
  'category.einzahlung.hint': 'Monthly amount and saving phase',
  'category.auszahlung.label': 'Withdrawals',
  'category.auszahlung.hint': 'Payout and withdrawal phase',
  'category.kurven.label': 'Curves',
  'category.kurven.hint': 'Which series, which style',
  'category.zeit.label': 'Time',
  'category.zeit.hint': 'Age, start year, axis labelling',
  'category.wertpapiere.label': 'Securities',
  'category.wertpapiere.hint': 'Load real price histories',
  'category.annahmen.label': 'Assumptions',
  'category.annahmen.hint': 'Inflation, savings rate, conventions',

  // Szenarien
  'scenario.add': 'Add scenario',
  'scenario.duplicate': 'Duplicate',
  'scenario.delete': 'Delete',
  'scenario.show': 'Show',
  'scenario.hide': 'Hide',
  'scenario.limit': '{max} scenarios is the maximum – that is as many colours as stay distinguishable.',
  'scenario.limitShort': 'At most {max} scenarios',
  'scenario.lastOne': 'The last scenario cannot be deleted',

  // Parameter
  'param.monthlyContribution.label': 'Monthly contribution',
  'param.annualRate.label': 'Return p. a.',
  'param.annualRate.hint': 'Effective annual return after costs.',
  'param.initialCapital.label': 'Initial capital',
  'param.inflationRate.label': 'Inflation p. a.',
  'param.inflationRate.hint': 'Discounts the portfolio to today’s purchasing power.',
  'param.savingsRate.label': 'Savings account rate p. a.',
  'param.savingsRate.hint': 'Comparison rate for the savings account.',
  'param.monthlyWithdrawal.label': 'Monthly withdrawal',
  'param.monthlyWithdrawal.hint': 'Fixed amount taken out during the withdrawal phase.',
  'param.withdrawalRate.label': 'Withdrawal rate p. a.',
  'param.withdrawalRate.hint': 'Share of the portfolio at retirement, spread over months.',
  'param.group.basis': 'Basics',
  'param.group.entnahme': 'Withdrawal',
  'param.group.annahmen': 'Assumptions',

  // Zeitachse
  'timeline.accumulationYears.label': 'Saving phase',
  'timeline.accumulationYears.hint': 'Contributions are paid until here.',
  'timeline.withdrawalYears.label': 'Withdrawal phase',
  'timeline.withdrawalYears.hint': 'Then money is taken out; the rest keeps working.',
  'timeline.shared': 'Applies to all scenarios.',

  // Serien
  'series.compound.label': 'Compound interest',
  'series.compound.description': 'Portfolio value including reinvested returns.',
  'series.contributions.label': 'Without return',
  'series.contributions.description': 'Same payments in and out at 0 % return.',
  'series.purchasingPower.label': 'Purchasing power',
  'series.purchasingPower.description': 'Portfolio value in today’s money.',
  'series.savingsAccount.label': 'Savings account',
  'series.savingsAccount.description': 'Same contribution at the lower savings rate.',
  'series.withdrawn.label': 'Withdrawn',
  'series.withdrawn.description': 'Total withdrawn so far.',
  'series.marketReturn.label': 'Market history',
  'series.marketReturn.description': 'Actual monthly returns of the chosen security.',

  // Entnahmeregeln
  'withdrawal.rule': 'Rule',
  'withdrawal.percentRule.label': 'Percentage rule',
  'withdrawal.percentRule.description': 'Fixed share of the portfolio at retirement (4 % rule).',
  'withdrawal.fixedAmount.label': 'Fixed amount',
  'withdrawal.fixedAmount.description': 'The same amount every month, whatever the portfolio.',

  // Stile
  'style.label': 'Style',
  'style.clean.label': 'Clean',
  'style.clean.description': 'Thin lines, fine grid, quiet axes.',
  'style.sketch.label': 'Sketched',
  'style.sketch.description': 'As if drawn by hand.',
  'style.minimal.label': 'Minimal',
  'style.minimal.description': 'No grid or axes, thick curves.',
  'style.bold.label': 'Bold',
  'style.bold.description': 'Thick lines with a filled area below.',
  'style.presentation.label': 'Presentation',
  'style.presentation.description': 'Larger type for projectors and screenshots.',

  // Modell
  'model.compounding': 'Compounding',
  'model.compounding.monthly-effective': 'Effective',
  'model.compounding.monthly-nominal': 'Nominal',
  'model.compounding.annual': 'Annual',
  'model.timing': 'Contribution',
  'model.timing.end': 'In arrears',
  'model.timing.start': 'In advance',
  'model.amounts': 'Amounts',
  'model.amounts.nominal': 'Nominal',
  'model.amounts.real': 'Inflation-adjusted',
  'model.timeAxis': 'Time axis',
  'model.timeAxis.relative': 'Years from 0',
  'model.timeAxis.age': 'Age',
  'model.timeAxis.calendar': 'Calendar year',
  'model.startAge': 'Age at start',
  'model.startYear': 'Start year',
  'model.noAnchor': 'none',
  'model.startYear.needed':
    'Without a start year the price curve stays empty: real returns are tied to real months, and no price can be projected forward.',
  'model.anchors.hint': 'The labelling only changes the axis, never a number.',

  // Kennzahlen
  'stat.atRetirement': 'At retirement',
  'stat.monthlyWithdrawal': 'Monthly withdrawal',
  'stat.nominalAtStart': 'nominally {value} at the start',
  'stat.lasts': 'Capital lasts',
  'stat.lasts.through': 'lasts throughout',
  'stat.lasts.until': 'until year {year}',
  'stat.remaining': 'Remaining capital',
  'stat.final': 'Final capital',
  'stat.contributed': 'Contributed',
  'stat.interest': 'Interest earned',
  'stat.interestShare': 'Interest share',
  'stat.ofVisible': 'of {count} visible · compare in legend and table',

  // Chart und Tabelle
  'chart.years': 'Years',
  'chart.age': 'Age',
  'chart.calendar': 'Year',
  'chart.retirement': 'Retirement',
  'chart.noScenario': 'No scenario visible – show at least one.',
  'chart.noSeries': 'No series active – pick at least one.',
  'table.title': 'Yearly values as a table',
  'table.caption': 'Development per year for all active series',
  'table.year': 'Year',
  'encoding.colorBySeries': 'Colour = series',
  'encoding.colorByScenario': 'Colour = scenario',
  'encoding.colorByScenarioWithStyle': 'Colour = scenario · dash = series',
  'capacity.crowded': '{count} lines in the chart. Fewer scenarios or series read more easily.',
  'capacity.over':
    '{count} lines are hard to tell apart. Hide scenarios or series – the table still shows every value.',

  // Wertpapier
  'market.label': 'Security',
  'market.placeholder': 'e.g. AAPL',
  'market.load': 'Load prices',
  'market.history': 'since {start} · {years} years of history',
  'market.unavailable': 'The price endpoint is not responding.',
  'market.import': 'Load a price file (CSV or JSON)',
  'market.needsStartYear':
    'The price curve needs a start year – set it under “General”. Only then is it clear from when the position would have been held.',
  'market.startsLater': 'Only traded from {jahr} – no curve before that year.',
  'market.noServer':
    'This deployment has no price endpoint. Everything else works; prices come from a file – or start the app with `npm run serve`.',
  'market.badFile':
    'Could not read the file – expected at least 13 monthly prices with a date and a price column.',

  // Video
  'video.title': 'Create video',
  'video.format': 'Format',
  'video.scenes': 'Scenes',
  'video.scene.hook': 'Hook',
  'video.scene.build': 'Build-up',
  'video.scene.punchline': 'Punchline',
  'video.placeholders': 'Placeholders',
  'video.record': 'Record ({seconds} s)',
  'video.recording': 'Recording … {percent} %',
  'video.download': 'Download (.{extension})',
  'video.convert': 'Convert to MP4 (loads ~30 MB)',
  'video.converting': 'Converting … {percent} %',
  'video.mp4': 'Recording as MP4 – ready for Instagram and TikTok.',
  'video.webm': 'This browser only records WebM. You can convert it to MP4 right here after recording.',
  'video.unsupported': 'This browser cannot record video.',
  'video.realtime': 'Recording runs in real time, so it takes as long as the video.',

  // Theme
  'theme.label': 'Colour scheme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',
  'locale.label': 'Language',
}
