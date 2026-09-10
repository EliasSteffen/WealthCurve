/**
 * Erzeugt die Symboldateien in public/ aus der Marke in src/render/logo.ts.
 *
 *     npm run icons
 *
 * Erzeugt statt gepflegt, damit Kopfzeile, Tab-Symbol und Startbildschirm
 * dieselbe Marke zeigen - eine handgeschriebene Kopie läuft beim ersten
 * Nachschärfen auseinander, und beim Favicon merkt es niemand.
 */
import { Path2D, createCanvas } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOGO_BACKGROUND, drawLogo, logoSvg, type LogoCanvas } from '../src/render/logo.ts'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

/**
 * Ein PNG mit Rand.
 *
 * Der Rand ist kein Geschmack: iOS beschneidet das Symbol des Startbildschirms
 * zu einem abgerundeten Quadrat, und Android schneidet bei maskierbaren
 * Symbolen bis zu 20 % je Seite weg. Ohne Reserve verlöre die Kurve ihre Enden.
 */
function png(size: number, randAnteil: number, background: string): Buffer {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, size, size)

  const rand = Math.round(size * randAnteil)
  // Die normale Strichstärke, nicht die kompakte: diese Symbole erscheinen ab
  // 60 px. Mit der Reserve für 16 px wurde daraus ein Klumpen statt einer Kurve.
  ctx.translate(rand, rand)
  drawLogo(ctx as unknown as LogoCanvas, size - rand * 2, Path2D)
  return canvas.toBuffer('image/png')
}

const dateien: Array<readonly [string, string | Buffer]> = [
  [
    'favicon.svg',
    logoSvg({
      variante: 'kompakt',
      comment: [
        '    Erzeugt aus src/render/logo.ts - nicht von Hand aendern, sondern',
        '    dort und danach `npm run icons`. Feste Farben, weil ein Favicon',
        '    ausserhalb der Seite gezeichnet wird und deren CSS-Variablen nicht',
        '    kennt; die Variante "kompakt" hat die Strichstaerke fuer 16 px.',
      ].join('\n'),
    }),
  ],
  // Apple zeigt das Symbol ohne Transparenz - ein durchsichtiger Grund wuerde
  // schwarz. Deshalb der helle Seitengrund statt keiner Farbe.
  ['apple-touch-icon.png', png(180, 0.14, LOGO_BACKGROUND.light)],
  ['icon-192.png', png(192, 0.14, LOGO_BACKGROUND.light)],
  ['icon-512.png', png(512, 0.14, LOGO_BACKGROUND.light)],
  // Maskierbar: Android legt eine eigene Form darueber und schneidet grosszuegig.
  ['icon-maskable-512.png', png(512, 0.22, LOGO_BACKGROUND.light)],
]

for (const [name, inhalt] of dateien) {
  writeFileSync(join(publicDir, name), inhalt)
  console.log(`geschrieben: public/${name}`)
}
