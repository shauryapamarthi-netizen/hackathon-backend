# Air Drum

A browser drum studio with selected-hand tracking, pencil tracking, drumhead hit areas, and an adaptive practice coach.

## Run locally

For the static studio, run `npm run demo` and open `http://127.0.0.1:4173/studio.html`. This preview needs no npm dependencies. Do not open the HTML using a file URL.

For the Express API, database, and studio, run `npm install` followed by `npm start`, then open `http://localhost:3000/studio.html`. Configure `PORT` (default 3000), `MONGODB_URI`, and optionally `ANTHROPIC_API_KEY` in the server environment. The server uses MongoDB for exercises, attempts, and skill history. Without the AI API key it provides built-in coaching responses.

The static frontend deployment alone does not host `/chat`, `/attempts`, or `/next-exercise`. Those coach features require the backend at the same origin or configured routing to it. Tracking, local audio, and practice recording work without that backend.

## Hands

1. Select **Hands**, enable the camera, and continue past the camera setup screen.
2. Click **Start tracking**, then hold two open hands apart for about one second. Setup dots are yellow; selected hands are green and purple.
3. Arrange the drums and choose **Play**. Strike downward from above the drumhead using three distinct fingertip nodes from one hand together, or one palm-center node.
4. Lift the striking nodes clear before the next hit. Palm and fingertip hits share a 100 ms cooldown per hand and drum. Sideways touches and upward returns stay silent. A blocked hit is not queued for later playback.

Each hand shows the palm center, pointer, middle, pinky, and thumb tips. A resting palm does not block a separate three-fingertip stroke. Fast downward crossings between frames count; the three finger contact intervals must overlap. Hand selection tolerates fast direction reversals and partial-point visibility. Missing observations alone never trigger sound. Motion history survives gaps up to 80 ms; longer losses require fresh contact. Ten seconds without either selected hand stops the camera and releases the model. **Set up hands again** deliberately selects new hands.

**Hit area** adjusts the visible and detected ellipse together from 80% to 125%, defaulting to 100% of the rendered drumhead bounds. The ellipse follows the viewing angle, size, and position. Top drums appear larger and lower drums smaller. Chrome stands are decorative and cannot be struck. Top-only strikes use camera-preview coordinates, not measured physical room depth.

The camera guide uses local lighting and edge heuristics for framing suggestions. It does not reconstruct the room or upload video. MediaPipe downloads its model on first use and still computes all 21 landmarks; the application uses five points per hand. Session selection is geometric continuity, not biometric identity.

## Pencils

1. Choose **Pencils: pink + cyan tips** or **Pencils: yellow wood (#2)**. Use bright lighting and a plain background. Pink/cyan tape is recommended.
2. Enable the camera and start tracking. Dots follow the detected pencil tips.
3. Arrange drums so the gold strike lines lie where the tips land, then choose **Play** and strike downward. Bounce or lift to rearm.
4. **Pencil sensitivity** controls the minimum downward speed. Hand mode has a separate drumhead radius control.

Pencil color detection and line collision retain the team's current pencil implementation. Yellow pencils remain a color/shape heuristic, not general object recognition. Switching inputs stops and resets the previous tracker.

## Practice and coaching

Enable sound to use the drum buttons or keys A / S / D / F / Space. The browser generates snare, tom, hi-hat, crash, and kick samples once and allows overlapping voices. The metronome, practice recorder, timing summary, and downloadable JSON hit log work locally.

The backend chooses the next exercise from the user's weakest skill and records results through `/attempts`. The coach UI loads suggestions from `/next-exercise`, watches completed practice summaries, and uses `/chat` for tutoring. The getting-started checklist and camera calibration are retained. The `/simple` server route provides the team's separate microphone-based practice page.

## Integration

`window.airDrumStudio.getLayout()` returns the rendered drumhead centers and dimensions in normalized, mirrored camera coordinates. Hand hit radii are `width * radiusScale / 2` and `height * radiusScale / 2`. `getPadLayout()` supplies the pencil detector's pad geometry; `getMode()` returns arrange/play; `stopCamera()` releases capture.

`hand-input.js` connects the selected `HandSession` to named strike points and the overlay. `strike-detector.js` handles the palm/three-fingertip rule. `pencil-tracker.js` and `pencil-strike-detector.js` provide the separate pencil pipeline. The `hands-detected` event carries selected hands, preview hands, overlay points, strike points, and a timestamp; stop events clear the selection.

External integrations can call `window.airDrumStudio.hit('snare', 0.85)` or dispatch a `drum-hit` event with `{drum, velocity}`. Supported drum names are `snare`, `hi-hat`, `mid-tom`, `crash`, and `kick`; aliases such as `hihat` and `bass` are accepted. The call returns false outside Play, before sound is ready, or for invalid input. Backend input also accepts existing WebSocket `drum_hit` messages. Camera video is not sent to these endpoints.

## Verification and limits

`npm test` covers hand selection, timeouts, projected geometry, top-only strikes, the three-fingertip or palm rule, shared cooldowns, short dropouts, pencil strikes, and overlapping audio voices. Synthetic tests cover 20 three-fingertip strokes spaced 120 ms apart.

The live readout reports processed tracking frames per second and average input processing time, not end-to-end audio latency. Sound is scheduled before drawing the overlay. Browser integration checks use simulated hand and pencil observations; real-camera motion blur, inference performance, audible output, and latency must still be checked on the demo laptop.
