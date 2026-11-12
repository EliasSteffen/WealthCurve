import { lazy, Suspense } from 'react'
import { loadVideoWorkspace } from '../../lib/lazyVideo'
import { useT } from '../../react/localeContext'

/** Eigener Chunk: Canvas, Encoder und Tonspur braucht, wer nie ein Video macht, nicht. */
const VideoWorkspace = lazy(loadVideoWorkspace)

/**
 * Das Video als eigener Bereich statt als Reiter in einem Dialog: die Vorschau
 * bekommt den ganzen Bildschirm, die Einstellungen eine feste Spalte.
 */
export function VideoPage() {
  const t = useT()
  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <Suspense fallback={<p className="p-6 text-sm text-[var(--text-muted)]">{t('video.loading', 'Video-Werkzeug lädt …')}</p>}>
        <VideoWorkspace />
      </Suspense>
    </div>
  )
}
