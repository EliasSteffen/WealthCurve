import type { ReactNode } from 'react'
import {
  PARAMETERS,
  PARAM_IDS,
  type ParamGroup,
  type ParamId,
  type SimulationParams,
} from '../core/domain/parameters'
import { Card, CardTitle } from './ui/Card'
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
}

const GROUP_LABELS: Record<ParamGroup, string> = {
  basis: 'Parameter',
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
}: ParameterPanelProps) {
  return (
    <>
      {GROUPS.map((group) => {
        const ids = PARAM_IDS.filter(
          (id) => PARAMETERS[id].group === group && activeParamIds.has(id),
        )
        if (ids.length === 0) return null

        return (
          <Card key={group}>
            <CardTitle>{GROUP_LABELS[group]}</CardTitle>
            {groupExtras?.[group] ? <div className="mb-5">{groupExtras[group]}</div> : null}
            <div className="space-y-5">
              {ids.map((id) => (
                <SliderField
                  key={id}
                  definition={PARAMETERS[id]}
                  value={params[id]}
                  onChange={(value) => onChange(id, value)}
                />
              ))}
            </div>
          </Card>
        )
      })}
    </>
  )
}
