import type { VideoFormat } from './types'

/** Ein neues Format ist eine Zeile hier. */
export const VIDEO_FORMATS: readonly VideoFormat[] = [
  { id: 'reel', label: 'Hochformat 9:16', width: 1080, height: 1920 },
  { id: 'square', label: 'Quadrat 1:1', width: 1080, height: 1080 },
  { id: 'wide', label: 'Querformat 16:9', width: 1920, height: 1080 },
]

export const DEFAULT_FORMAT_ID = 'reel'

export function resolveFormat(id: string): VideoFormat {
  return VIDEO_FORMATS.find((f) => f.id === id) ?? VIDEO_FORMATS[0]
}
