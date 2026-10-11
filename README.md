# Air Drum — Self-Improving Practice Coach

Play drums with pencil taps (hand tracking coming from a teammate), get scored on rhythm, and let an adaptive backend pick what you should practice next based on what's actually helping you improve. Built for a Penn State hackathon.

## What's in this repo

- **`server.js` + `models/` + `lib/` + `config/`** — Express/MongoDB backend. Tracks exercises, attempts, and per-skill history, picks the next exercise based on each user's weakest skill, and uses the Claude API to generate feedback and power an in-app drum-teaching chatbot.
- **`dist/`** — The Air Drum frontend: camera preview and drum arrangement (`app.js`), synthesized drum audio (`drum-audio.js`), 3D drum visuals (`drum-visuals.js`), pencil-tip color tracking (`pencil-tracker.js`) feeding a generic line-crossing hit detector (`strike-detector.js`), metronome/recording/practice UI (`performance.js`), a camera-angle calibration helper (`calibration.js`), and the layer that connects the UI to the backend — reporting practice results, loading the next suggested exercise, and running the chat tutor (`coach.js`).
- **`public/`** — a minimal microphone-based pitch/rhythm test page for other instruments, served at `/simple`.

## Run it

```
npm install
npm start
```

Then open `http://localhost:3000` for the home page, or `http://localhost:3000/studio.html` to go straight into the Air Drum studio (served from `dist/`). `http://localhost:3000/simple` has a plain pitch-practice test page.

You'll need a `.env` file with:

```
PORT=3000
MONGODB_URI=<your MongoDB Atlas connection string>
ANTHROPIC_API_KEY=<optional, enables real AI feedback and chat coaching>
```

Without `ANTHROPIC_API_KEY`, feedback and chat still work using built-in fallback responses — nothing crashes, you just don't get Claude-generated text.

For a standalone static preview of just the frontend (no backend, no database): `npm run demo`, then open `http://127.0.0.1:4173/studio.html` (not `file://`).

## How the adaptive loop works

1. The frontend asks `/next-exercise?userId=...` for what to practice. The backend looks at the user's skill history, finds their weakest skill, and returns the exercise targeting that skill with the best track record of actually improving players (`avgImprovement`) system-wide.
2. The user plays along (drum hits via pencil tracking, hand tracking once a teammate wires it in, or keyboard, or sung/played pitch via microphone on the `/simple` page).
3. The frontend posts the result to `/attempts`. The backend scores improvement versus the user's last attempt on that skill, updates that exercise's system-wide improvement stats, and generates feedback via Claude.
4. The next `/next-exercise` call picks up the user's updated skill history, closing the loop.

## How to play with pencils

1. **Enable sound** → test pads should click.
2. **Enable camera**.
3. Choose input:
   - **Pencils · pink + cyan tips** (most reliable): wrap one tip in bright magenta/pink tape, the other in cyan. Plain background, bright light.
   - **Pencils · yellow wood (#2)**: two classic yellow pencils; tips track graphite/eraser ends.
4. **Start pencil tracking** — colored dots should sit on the **tips**, not the middle of the stick.
5. **Arrange** drums so gold strike lines sit where your strokes land, with room above to lift.
6. **Play** → strike **down** through a gold line. For rolls, a small bounce re-arms (you don't need a huge lift every time).
7. Raise **Sensitivity** if light strokes miss; lower it if you get false hits.

If tips still miss: use a bright desk lamp on the kit area, a plain wall/desk background (no clutter in the tip color you chose), and check whether you're on neon tape or yellow #2 mode. Camera + computer vision stay in the browser; no API key needed for tracking.

## Connect a hand tracker

`strike-detector.js` exposes a generic `StrikeDetector` class that takes normalized tracked points (`{id, x, y}`) and zone layouts and returns hits — it doesn't care whether those points come from pencil tips or hand landmarks. A hand-tracking teammate can feed points into the same detector, or call the existing integration point directly:

```js
window.airDrumStudio.hit('snare', 0.85);
```

Drum IDs: `snare`, `hi-hat`, `mid-tom`, `crash`, `kick`. Velocity is a finite number from 0 to 1. Returns true when played; false if audio isn't ready, Arrange mode is active, or input is invalid.

Alternatively:

```js
window.dispatchEvent(new CustomEvent('drum-hit', {
  detail: { drum: 'snare', velocity: 0.85 }
}));
```

`window.airDrumStudio.getLayout()` provides normalized mirrored camera-image drum coordinates and dimensions; `getMode()` gives arrange/play. The existing `#video` element provides the camera preview.

## Tests

`npm test` runs the audio buffer/overlap checks in `tests/`.


## Select pencil tips and set the hitbox radius
Start pencil tracking, choose **Select / reset tips**, and click each visible pencil tip in the camera image. Click **Done selecting**, then play. Lost or ambiguous tips require selection again; background color blobs are never acquired automatically. Pink/cyan tape is recommended; yellow-pencil mode is still a color/shape heuristic, not general object recognition.

The **Hitbox radius** slider controls a visible circle and the actual swept collision against the strike line, in display pixels. Existing coach, calibration, backend and practice controls are preserved. Automated checks cover selection, distractors, lost tracking and radius collisions; real-camera testing remains necessary.
