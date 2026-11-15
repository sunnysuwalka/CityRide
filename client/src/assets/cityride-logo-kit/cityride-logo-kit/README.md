# CityRide logo kit

Final mark: an open "C" route with a stop dot. A bold C on a navy rounded tile, with a blue stop in its opening.

## Colours
| Name | Hex | Use |
|---|---|---|
| Primary navy | #0B2D6B | Mark tile, wordmark on light backgrounds |
| Accent blue | #1E6BFF | Stop dot |
| White | #FFFFFF | C stroke, reversed tile, wordmark on dark backgrounds |
| Light blue | #6FA0FF | Stop dot on dark backgrounds (glyph-white only) |

## Files
- `svg/` master vector files. Wordmark text is outlined (Inter Bold), so no font is needed.
  - `mark-primary`, `mark-reversed`: tile mark for light and dark/navy backgrounds.
  - `glyph-*`: C and dot without the tile (navy, white, single-colour navy, single-colour white).
  - `lockup-horizontal-*`, `lockup-stacked-*`: mark plus wordmark (primary, reversed, mono).
  - `wordmark-navy`, `wordmark-white`: text only.
  - `ios-icon`, `play-store-icon`, `avatar`, `og-image*`: artwork sources.
- `png/` transparent PNG exports in several sizes.
- `app-icons/ios`: 1024 App Store icon (square, no rounding, no transparency) and 180 apple-touch-icon.
- `app-icons/android`: adaptive icon foreground, background and monochrome (432 px), plus 512 Play Store icon.
- `app-icons/pwa`: 192 and 512 icons, plus a 512 maskable icon (artwork stays inside the safe zone).
- `web/`: favicon.svg, favicon.ico (16, 32, 48) and PNGs. The favicon is a heavier-stroke version for tiny sizes.
- `social/`: 800 avatar, 1200x630 Open Graph image (navy and light).

## Usage
- Use the primary lockup on white or light backgrounds, the reversed lockup on navy or dark backgrounds. Use mono lockups only when one colour is required.
- Clear space: keep at least half the mark's height free on all sides.
- Minimum size: mark 16 px (use the favicon files below 32 px), horizontal lockup 120 px wide.
- Do not stretch, rotate, recolour, add shadows, or change the wordmark font.

## Web snippet
```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/manifest.webmanifest">
```
```json
{ "icons": [
  { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
  { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
  { "src": "/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" } ] }
```
