import { lazy, Suspense, useEffect, useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import { useSelector } from '../react/useSelector'
import { DepotPage } from './depot/DepotPage'
import { PlanPage } from './plan/PlanPage'
import { TopBar } from './shell/TopBar'
import { VideoPage } from './shell/VideoPage'

/** Die Befehlspalette lädt erst beim ersten Öffnen. */
const CommandPalette = lazy(() => import('./shell/CommandPalette').then((m) => ({ default: m.CommandPalette })))

/**
 * Die App: eine Kopfzeile, darunter genau ein Bereich.
 *
 * Gescrollt wird im Bereich, nie die Seite - die Kopfzeile bleibt stehen. Auf
 * großen Schirmen füllen Plan und Video das Fenster exakt und scrollen in ihren
 * Spalten; das Depot und alle kleinen Schirme scrollen als Ganzes.
 */
export function Dashboard() {
  const { theme, setTheme } = useTheme()
  const page = useSelector((s) => s.page)
  const [palette, setPalette] = useState<{ offen: boolean; geladen: boolean }>({ offen: false, geladen: false })

  // ⌘K / Strg+K von überall - auch aus einem Eingabefeld heraus, wie in jedem Terminal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => ({ offen: !p.offen, geladen: true }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopBar theme={theme} onThemeChange={setTheme} onOpenPalette={() => setPalette({ offen: true, geladen: true })} />

      {/* key: ein Bereichswechsel beginnt oben, nicht an der Scrollposition des anderen. */}
      <main
        key={page}
        className={
          page === 'depot'
            ? 'thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain'
            : 'thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain lg:overflow-hidden'
        }
      >
        {page === 'depot' ? <DepotPage /> : page === 'video' ? <VideoPage /> : <PlanPage />}
      </main>

      {palette.geladen ? (
        <Suspense fallback={null}>
          <CommandPalette
            open={palette.offen}
            onClose={() => setPalette((p) => ({ ...p, offen: false }))}
            theme={theme}
            onThemeChange={setTheme}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
