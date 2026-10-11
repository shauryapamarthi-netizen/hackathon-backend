# Air Drum — camera-to-sound integration

## Run the demo (Node.js 20+)

From this unzipped project folder:

```sh
node start.cjs
```

Open **http://127.0.0.1:4173/studio.html** in Chrome or Edge. The demo server has no npm dependencies. Do not open the HTML as a file:// URL.

For the existing Express API plus studio, run `npm install`, then `npm start`, and open http://localhost:3000/studio.html. Existing exercise/attempt endpoints are retained. Attempts remain in memory as in the original project; this is not a production storage service.

## Selected hand tracking

The Hands input in `/studio.html` now uses the hand-detection component.
Enable the camera, click Start tracking, and hold both open hands apart for
about one second. Yellow dots indicate setup; green and purple identify the
selected hands. Use Set up hands again to deliberately select new hands.

Each hand shows palm center, pinky tip, middle-finger tip, pointer fingertip,
and thumb tip. One matching point inside the frame can preserve selection.
Any of these five points can play a drum by entering its glowing circular
or elliptical hit area. Contacts from multiple points of one hand are
combined into one sound per drum. Move all points clear of that area before
touching it again. Fast segments that cross the entire area between frames
are detected too. A new or reacquired point already inside an area does not
produce a phantom strike; move out and back in to play it.

The Hit area slider sets the visible and detected radius together, from
100% to 180% of the drum bounds (125% by default). This is the projected
hit area around the 3D-looking drum, not measured physical depth.

One selected hand keeps tracking alive. If neither selected hand matches for
10 continuous seconds, tracking and the camera stop. Enable the camera and
start tracking again to restart. During setup, any in-frame hand point resets
the same timeout. Camera capture requests 640x480 at 60 fps, uses available
GPU acceleration with CPU fallback, and follows new video frames.

Selection uses movement continuity, not personal identity. Keep bystanders
out of view. In-frame landmarks are model estimates, not proof that a point
is unoccluded. MediaPipe must still detect a hand; it computes all 21
landmarks even though only five are drawn.

Integration files: `dist/hand-session.js` manages selection;
`dist/hand-input.js` adapts model output into mirrored overlay and strike
coordinates. `performance.js` connects them to the existing audio and layout.
The browser emits `hands-detected` events with selected hands, timestamps,
state, overlayPoints and strikePoints. Stop events clear the selected hands.
No additional server endpoint or npm dependency is required.

## First successful hit

1. Click **Enable sound**. Test each of the instrument buttons. A/S/D/F and Space also play hi-hat/snare/tom/crash/kick when focus is not in a form control or button.
2. Enable the camera. Leave **Hands** selected and click **Start tracking**. The MediaPipe model downloads on first use; allow a little time. A clear failure message leaves manual drum buttons available if download or initialization fails.
3. In Arrange mode, drag the drums to comfortable positions. Keep the fingertip cursors visible, with room above every drum.
4. Select **Play**. Move any of the five tracked points into a glowing drum area from any direction. Move clear before touching it again. Holding points inside does not repeatedly trigger it.
5. Increase **Hit area** if the targets feel too small. Use speakers or wired headphones when assessing latency.

For sticks/pencils: select **Sticks · pink + cyan tips**. Wrap one tip in bright magenta/pink tape and the other in cyan tape (one unique color per stick). Use good lighting and a plain background without either color. The marker should appear at least five pixels wide in the small detection image. This mode detects colored blobs; it does not recognize arbitrary unmarked pencils. Position the camera so strokes visibly travel down the image. Pink and cyan cursors mark detected tips.

## Included

- Existing design, camera preview, draggable saved layout and 3D drum rendering preserved.
- Added a real snare zone to match the original sidebar; tom, hi-hat and crash retained. Kick is manual/keyboard only.
- Original synthesized snare, kick, tom, hi-hat and crash samples generated once in browser memory. No sample licensing, paid API or per-hit network requests. These are synthesized sounds, not studio recordings.
- Separate voices for overlapping hits, volume and stroke strength, plus matching drum flashes.
- Selected-hand tracking with five-point overlays; mirrored normalized coordinates match the camera overlay.
- Pink/cyan connected-component marker tracking for two sticks.
- Swept contact detection against the visible hit areas, per-hand/drum contact deduplication, leave-to-rearm, cooldown, and reset after tracking loss.
- Metronome, session event recording, JSON download and measured timing summary. Feedback is a deterministic timing calculation, not an LLM/AI coach. The summary compares each hit to the nearest click; it does not score missing notes or identify the correct instrument.
- Explicit WebSocket backend input mode for integration with a separate tracker.

## Backend integration contract

The uploaded Node backend has exercise/attempt routes but **no hand-tracking implementation or WebSocket endpoint**. The new working camera modes process video in the browser, on the player's computer, even when the page is hosted online. This avoids a video round trip for each hit. The Backend input option is a receiver for an existing or future tracking backend; it is not a new hosted vision service.

If your teammate runs a local or remote tracking service, have it expose a WebSocket endpoint and send:

```json
{"type":"drum_hit","drum":"snare","velocity":0.85,"eventId":"unique-hit-123"}
```

Canonical drum IDs: `snare`, `hi-hat`, `mid-tom`, `crash`, `kick`. `velocity` is a finite number in [0,1]. `eventId` is optional and deduplicated over the last 1,000 events. One event per strike. The receiver accepts common hihat/tom/bass aliases. Select Backend, enter the endpoint, click Start tracking, and select Play. HTTPS pages require a `wss://` endpoint. Connections are explicit; on disconnection the user can reconnect with Start tracking.

The client does not upload video to this endpoint, nor automatically synchronize drum layouts. A server-side camera tracker must receive or configure the same layout. In the browser, `window.airDrumStudio.getLayout()` returns each zone's mirrored normalized center and width/height; the hit area is centered on `x,y`, with radii `width * radiusScale / 2` and `height * radiusScale / 2` (default radiusScale 1.25). Backend video capture and transport must be implemented separately if that architecture is required.

## Hosted/local use

- `dist/` can be hosted as static files over HTTPS; open `/studio.html`.
- The local demo command listens only on 127.0.0.1. HTTP camera access is permitted on localhost, not arbitrary LAN IPs. Use HTTPS hosting for teammates using their own devices.
- Camera and marker frames stay in the browser in the provided implementation. The hand mode downloads executable/model assets from jsDelivr and Google, so internet access is needed unless already cached. For a dependable offline event setup, vendor these assets and change the paths in `performance.js`.
- Hand model: MediaPipe Tasks Vision 0.10.21, Apache-2.0 library, loaded externally. See https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js and https://github.com/google-ai-edge/mediapipe for usage and licensing.
- A single webcam provides screen-space strikes, not accurate physical 3D contact or depth. The drums have a 3D appearance; collision detection is in the camera image.

## Validation and demo readiness

```sh
npm test
```

Automated detector checks cover contact from any direction, one-point contact, deduplication, boundary jitter, simultaneous hands, out-of-zone motion, reacquisition, radius scaling, and fast crossings. Audio checks cover generated buffers and independent overlapping voices. JavaScript syntax and static serving are checked.

A headless Chromium smoke check verified that the studio loads its five-point tracking controls and overlay. Model execution, real camera tracking, audible output and end-to-end latency have **not** been verified here. No latency number or competition outcome is guaranteed. Before presenting, run the steps above on the actual laptop, test both hands and colored tips, and adjust placement/sensitivity. A real-camera test remains essential.

## Main changes

- `dist/strike-detector.js`: independently testable strike detection.
- `dist/drum-audio.js`: one-shot audio engine.
- `dist/performance.js` / `.css`: tracking, controls, backend event receiver and practice tools.
- `dist/app.js`, `dist/drum-visuals.js`, `dist/studio.html`: integration and snare fix.
- `server.js`: serves the existing frontend as well as existing API routes.
- `package.json`: demo/start/test commands.

This integration does not deploy the website or change the exercise/attempt API.
