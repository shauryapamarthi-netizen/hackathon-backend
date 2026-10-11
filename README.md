# Air Drum — audio only

Hand tracking, colored-tip tracking, hit detection, sensitivity controls, overlays and automatic tracking model downloads have been removed. Camera preview and drum arrangement remain for your teammate to use. No WebSocket connection is created by this version.

## Run

Run `node start.cjs` from this folder, then open http://127.0.0.1:4173/studio.html. For the Express API, use `npm install` then `npm start`.

Click Enable sound. Test drum buttons or use A/S/D/F/Space when focus is outside form controls and buttons. In Play mode, the drum zones are clickable too. Volume, animations, metronome, practice timing summary, recording and JSON export remain. Samples are synthesized locally; no API key needed.

## Connect your teammate's tracker

After the user clicks Enable sound and selects Play, call once per detected hit:

```js
window.airDrumStudio.hit('snare', 0.85);
```

Drum IDs: `snare`, `hi-hat`, `mid-tom`, `crash`, `kick`. Velocity is a finite number from 0 to 1. Returns true when played; false if audio is not ready, Arrange mode is active, or input is invalid. The function triggers audio, visual feedback and recording together.

Alternatively:

```js
window.dispatchEvent(new CustomEvent('drum-hit', {
  detail: { drum: 'snare', velocity: 0.85 }
}));
```

`window.airDrumStudio.getLayout()` provides normalized mirrored camera-image drum coordinates and dimensions; `getMode()` gives arrange/play. The existing `#video` element provides the camera preview. Your teammate owns tracking and strike detection and can call the hit function from their WebSocket handler or browser tracker. No gold strike-line rule is imposed by this audio code.

## Upload this revision

Replace the files at their existing repository paths, especially `dist/performance.js`, `dist/performance.css`, `dist/app.js` and `dist/studio.html`. `dist/strike-detector.js` and `tests/strike-detector.cjs` are intentionally inactive placeholders so a browser upload also neutralizes the prior files. They can be deleted later.

Run `npm test` for the audio buffer/overlap check. This revision has been syntax checked and audio logic tested; physical audio output and your teammate's tracker need testing on the demo machine. The live site is unchanged until you commit these files and Vercel redeploys.
