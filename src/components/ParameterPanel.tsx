import type { ReactNode } from 'react'
import {
  PARAMETERS,
  PARAM_IDS,
  type ParamDefinition,
  type ParamGroup,
  type ParamId,
  type SimulationParams,
} from '../core/domain/parameters'
import { useT } from '../react/localeContext'
import { SliderField } from './ui/SliderField'

interface ParameterPanelProps {
  readonly params: SimulationParams
  /** Nur diese Regler werden gezeigt - der Rest hat gerade keine Wirkung. */
  readonly activeParamIds: ReadonlySet<ParamId>
  readonly onChange: (id: ParamId, value: number) => void
  /**
   * Zusatzsteuerung je Gruppe, oberhalb der Regler eingehängt - so steht z. B.
   * die Entnahmeregel direkt bei den Entnahme-Parametern, auf die sie wirkt,
   * ohne dass das Panel die Regel kennen müsste.
   */
  readonly groupExtras?: Partial<Record<ParamGroup, ReactNode>>
  /** IDs aus der Suche; null = keine Suche aktiv. */
  readonly matches?: ReadonlySet<string> | null
}

const GROUP_LABELS: Record<ParamGroup, string> = {
  basis: 'Grundwerte',
  entnahme: 'Entnahme',
  annahmen: 'Annahmen',
}

const GROUPS: readonly ParamGroup[] = ['basis', 'entnahme', 'annahmen']

/**
 * Zeigt ausschließlich Regler, die gerade etwas bewirken.
 *
 * Ein Parameter ist aktiv, wenn ihn eine eingeschaltete Serie oder die gewählte
 * Entnahmeregel liest. Gruppen ohne aktiven Parameter verschwinden ganz - eine
 * Karte, die nur mitteilt, dass sie gerade nichts tut, kostet nur Platz.
 */
export function ParameterPanel({
  params,
  activeParamIds,
  onChange,
  groupExtras,
  matches = null,
}: ParameterPanelProps) {
  const t = useT()
  const sichtbar = (id: ParamId) =>
    activeParamIds.has(id) && (matches === null || matches.has(`param:${id}`))

  return (
    <div className="space-y-5">
      {GROUPS.map((group) => {
        const ids = PARAM_IDS.filter((id) => PARAMETERS[id].group === group && sichtbar(id))
        const extra = groupExtras?.[group]
        const extraZeigen =
          extra && (matches === null || matches.has('model:withdrawalRule')) && ids.length > 0
        if (ids.length === 0) return null

        return (
          <div key={group} className="space-y-4">
            {/* Untergruppe innerhalb der Kategorie - nur wenn es mehr als eine gibt. */}
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t(`param.group.${group}`, GROUP_LABELS[group])}
            </div>
            {extraZeigen ? extra : null}
            {ids.map((id) => {
              // as const satisfies verengt die Registry-Typen so, dass
              // optionale Felder je Eintrag verschwinden.
              const def: ParamDefinition = PARAMETERS[id]
              return (
              <SliderField
                key={id}
                definition={{
                  ...def,
                  label: t(`param.${id}.label`, def.label),
                  hint: def.hint ? t(`param.${id}.hint`, def.hint) : undefined,
                }}
                value={params[id]}
                onChange={(value) => onChange(id, value)}
              />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
