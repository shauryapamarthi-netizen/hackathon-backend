(() => {
  const video = document.getElementById('video');
  const overlay = document.getElementById('calibrationOverlay');
  const message = document.getElementById('calibrationMessage');
  const brightnessMeter = document.getElementById('brightnessMeter');
  const surfaceMeter = document.getElementById('surfaceMeter');
  const continueBtn = document.getElementById('calibrationContinue');
  if (!video || !overlay) return;

  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 60;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let dismissed = false;
  let timer = null;

  function analyzeFrame() {
    if (!video.videoWidth) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let total = 0;
    const lowerThird = [];
    const rowStart = Math.floor(canvas.height * 0.6);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        total += lum;
        if (y >= rowStart) lowerThird.push(lum);
      }
    }
    const avgBrightness = total / (canvas.width * canvas.height);

    const mean = lowerThird.reduce((a, b) => a + b, 0) / lowerThird.length;
    const variance = lowerThird.reduce((a, b) => a + (b - mean) ** 2, 0) / lowerThird.length;
    const flatness = Math.max(0, 100 - Math.sqrt(variance));

    return { avgBrightness, flatness };
  }

  function render() {
    if (dismissed) return;
    const result = analyzeFrame();
    if (!result) {
      message.textContent = 'Checking your camera view...';
      timer = setTimeout(render, 300);
      return;
    }

    const { avgBrightness, flatness } = result;
    const brightnessPct = Math.max(4, Math.min(100, (avgBrightness / 180) * 100));
    brightnessMeter.style.width = brightnessPct + '%';
    brightnessMeter.className = 'meter-fill ' + (avgBrightness < 40 || avgBrightness > 230 ? 'bad' : 'good');

    const surfacePct = Math.max(4, Math.min(100, flatness));
    surfaceMeter.style.width = surfacePct + '%';
    surfaceMeter.className = 'meter-fill ' + (flatness > 55 ? 'good' : 'bad');

    if (avgBrightness < 40) {
      message.textContent = "It's a bit dark. Add more light or face a window, then adjust your camera angle.";
    } else if (avgBrightness > 230) {
      message.textContent = 'Too bright or backlit. Try facing away from strong light behind you.';
    } else if (flatness <= 55) {
      message.textContent = 'Tilt your camera down a little so your desk or play surface fills the lower half of the frame.';
    } else {
      message.textContent = 'Looks good! Your desk surface is clearly visible.';
    }

    timer = setTimeout(render, 350);
  }

  video.addEventListener('loadedmetadata', () => {
    dismissed = false;
    overlay.hidden = false;
    render();
  });

  function dismiss() {
    dismissed = true;
    overlay.hidden = true;
    if (timer) clearTimeout(timer);
  }

  continueBtn.addEventListener('click', dismiss);
  video.addEventListener('emptied', dismiss);
})();
