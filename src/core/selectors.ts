/**
 * Winzige Selektor-Memoisierung - der Ersatz für reselect.
 *
 * Notwendig, nicht optional: `useSyncExternalStore` verlangt, dass der
 * Snapshot bei unverändertem State DIESELBE Referenz liefert. Würde eine
 * Ableitung bei jedem Aufruf ein neues Objekt bauen, ergäbe das eine
 * Endlos-Renderschleife statt eines Testfehlers.
 *
 * An den State-Typ gebunden, weil TypeScript `S` und die Eingabe-Tupeltypen
 * nicht in einem Zug inferieren kann:
 *
 *     const createSelector = createSelectorFactory<AppState>()
 */
export function createSelectorFactory<S>() {
  return function createSelector<A extends readonly unknown[], R>(
    inputs: { [K in keyof A]: (state: S) => A[K] },
    combine: (...args: A) => R,
  ): (state: S) => R {
    let lastInputs: A | null = null
    let lastResult: R

    return (state: S): R => {
      const next = inputs.map((input) => input(state)) as unknown as A
      if (lastInputs !== null && next.every((value, i) => Object.is(value, lastInputs![i]))) {
        return lastResult
      }
      lastInputs = next
      lastResult = combine(...next)
      return lastResult
    }
  }
}
