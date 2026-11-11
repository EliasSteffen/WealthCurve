import { SegmentedControl } from './SegmentedControl'

// Die Props-Form kommt vom Bauteil selbst, damit dessen Datei unberührt bleibt.
type Props<T extends string> = Parameters<typeof SegmentedControl<T>>[0]

/**
 * Segmentierte Auswahl mit dem Hinweis der gewählten Option darunter.
 *
 * Der Hinweis lag bisher nur als `title` am Knopf - den sehen Touch- und
 * Tastaturnutzer nie. Gerade „Nominal ergibt mehr als den eingegebenen
 * Jahreszins" gehört aber sichtbar hin. Die Zeile steht hier beim Aufrufer
 * und nicht im `SegmentedControl`, dessen Innenleben unberührt bleibt.
 */
export function SegmentedWithHint<T extends string>(props: Props<T>) {
  const hint = props.options.find((o) => o.value === props.value)?.hint
  return (
    <div>
      <SegmentedControl {...props} />
      {hint ? (
        <p
          // Wechselt die Option, soll auch ein Screenreader den neuen Hinweis hören.
          aria-live="polite"
          className="mt-1.5 text-[11px] leading-snug text-[var(--text-muted)]"
        >
          {hint}
        </p>
      ) : null}
    </div>
  )
}
