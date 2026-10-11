# Air Drum — advanced pencil tracking

Drop-in studio files for the BBG hackathon site. **Hand tracking is not included** (for your teammate). This pack adds fast pencil-tip tracking that feels like a real kit: tip endpoints (not blob centers), bounce re-arm for rolls, and ~38 ms cooldown for spam rhythms.

## Upload to GitHub (replace live studio)

1. Unzip `air-drum-pencil-tracking.zip` (or use this folder).
2. On GitHub → your repo → `dist/` → **Add file → Upload files**.
3. Upload / overwrite these files from `dist/`:

   - `performance.js`
   - `performance.css`
   - `app.js`
   - `studio.html`
   - `strike-detector.js`
   - `pencil-tracker.js`
   - `drum-audio.js` (keep if not already present)

4. Commit. Wait for Vercel **Ready**, then hard-refresh the studio (`⌘⇧R`).

Live URL pattern: `https://hackathon-backend-dist.vercel.app/studio.html`

## Local demo

```sh
node start.cjs
```

Open **http://127.0.0.1:4173/studio.html** (not `file://`).

```sh
npm test
```

## How to play with pencils

1. **Enable sound** → test pads should click.
2. **Enable camera**.
3. Choose input:
   - **Pencils · pink + cyan tips** (most reliable): wrap one tip in bright magenta/pink tape, the other in cyan. Plain background, bright light.
   - **Pencils · yellow wood (#2)**: two classic yellow pencils; tips track graphite/eraser ends.
4. **Start pencil tracking** — colored dots should sit on the **tips**, not the middle of the stick.
5. **Arrange** drums so gold strike lines sit where your strokes land, with room above to lift.
6. **Play** → strike **down** through a gold line. For rolls, a small bounce re-arms (you do not need a huge lift every time).
7. Raise **Sensitivity** if light strokes miss; lower it if you get false hits.

## What changed vs the old tracker

| Old | New |
|-----|-----|
| Blob **centroid** (late hits) | Tip = **bottom extremity** of the color blob |
| Lift fully above the line to re-arm | **Bounce re-arm** + lift |
| ~75 ms cooldown | **~38 ms** (rolls / 16ths) |
| Hands + markers mixed | **Pencil-only** (+ optional backend events) |
| 320×180 detect | **480×270** + adaptive smoothing |

Teammate API (unchanged): after Enable sound + Play,

```js
window.airDrumStudio.hit("snare", 0.85);
```

Backend WebSocket still accepts:

```json
{"type":"drum_hit","drum":"snare","velocity":0.85,"eventId":"unique-hit-123"}
```

## What I need from you (if tips still miss)

- Bright desk lamp on the kit area
- Plain wall/desk (no pink/cyan/yellow clutter for the mode you chose)
- Screenshot of the studio with tip dots visible (or “No neon tips found”)
- Whether you’re on neon tape or yellow #2 mode

Camera + CV stay in the browser. No API key.
