# Air Drum — Self-Improving Practice Coach

Hand-track drums in the air, get scored on rhythm and pitch, and let an adaptive backend pick what you should practice next based on what's actually helping you improve. Built for a Penn State hackathon.

## What's in this repo

- **`server.js` + `models/` + `lib/` + `config/`** — Express/MongoDB backend. Tracks exercises, attempts, and per-skill history, picks the next exercise based on each user's weakest skill, and uses the Claude API to generate feedback and power an in-app drum-teaching chatbot.
- **`dist/`** — The Air Drum frontend: camera preview and drum arrangement (`app.js`), synthesized drum audio (`drum-audio.js`), 3D drum visuals (`drum-visuals.js`), metronome/recording/practice UI (`performance.js`), a camera-angle calibration helper (`calibration.js`), and the layer that connects the UI to the backend — reporting practice results, loading the next suggested exercise, and running the chat tutor (`coach.js`).
- **`public/`** — a minimal microphone-based pitch/rhythm test page for other instruments, served at `/simple`.

## Run it

```
npm install
npm start
```

Then open `http://localhost:3000` for the full Air Drum studio (served from `dist/`), or `http://localhost:3000/simple` for the plain pitch-practice test page.

You'll need a `.env` file with:

```
PORT=3000
MONGODB_URI=<your MongoDB Atlas connection string>
ANTHROPIC_API_KEY=<optional, enables real AI feedback and chat coaching>
```

Without `ANTHROPIC_API_KEY`, feedback and chat still work using built-in fallback responses — nothing crashes, you just don't get Claude-generated text.

For a standalone static preview of just the frontend (no backend, no database): `npm run demo`, then open `http://127.0.0.1:4173/studio.html`.

## How the adaptive loop works

1. The frontend asks `/next-exercise?userId=...` for what to practice. The backend looks at the user's skill history, finds their weakest skill, and returns the exercise targeting that skill with the best track record of actually improving players (`avgImprovement`) system-wide.
2. The user plays along (drum hits via hand tracking or keyboard, or sung/played pitch via microphone on the `/simple` page).
3. The frontend posts the result to `/attempts`. The backend scores improvement versus the user's last attempt on that skill, updates that exercise's system-wide improvement stats, and generates feedback via Claude.
4. The next `/next-exercise` call picks up the user's updated skill history, closing the loop.

## Connect your teammate's hand tracker

After the user clicks Enable sound and selects Play, call once per detected hit:

```js
window.airDrumStudio.hit('snare', 0.85);
```

Drum IDs: `snare`, `hi-hat`, `mid-tom`, `crash`, `kick`. Velocity is a finite number from 0 to 1. Returns true when played; false if audio is not ready, Arrange mode is active, or input is invalid.

Alternatively:

```js
window.dispatchEvent(new CustomEvent('drum-hit', {
  detail: { drum: 'snare', velocity: 0.85 }
}));
```

`window.airDrumStudio.getLayout()` provides normalized mirrored camera-image drum coordinates and dimensions; `getMode()` gives arrange/play. The existing `#video` element provides the camera preview.

## Tests

`npm test` runs the audio buffer/overlap checks in `tests/`.
