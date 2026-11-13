/** ⌘ auf dem Mac, sonst Strg - so steht es auch auf der Tastatur. */
export const isMac = (): boolean => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
