(function(root) {
  function perspectiveScale(x, y) {
    const depth = Math.max(0, Math.min(1, y));
    const center = Math.max(0, 1 - Math.abs(x - 0.5) * 2);
    return (0.7 / (1 - 0.5 * depth)) * (0.85 + 0.15 * center);
  }

  function analyzeRoom(data, width, height) {
    const gray = new Float32Array(width * height);
    let total = 0;
    for (let i = 0; i < gray.length; i++) {
      gray[i] = data[i*4]*0.2126 + data[i*4+1]*0.7152 + data[i*4+2]*0.0722;
      total += gray[i];
    }
    const edges = [];
    for (let x = 8; x < width - 8; x += 8) {
      let strength = 30, bestY = -1;
      for (let y = Math.floor(height * 0.15); y < height * 0.85; y++) {
        const gradient = Math.abs(gray[(y+1)*width+x] - gray[(y-1)*width+x]);
        if (gradient > strength) { strength = gradient; bestY = y; }
      }
      if (bestY >= 0) edges.push({x,y:bestY});
    }
    let rollDegrees = null;
    if (edges.length >= 12) {
      const mx = edges.reduce((sum,p)=>sum+p.x,0)/edges.length;
      const my = edges.reduce((sum,p)=>sum+p.y,0)/edges.length;
      const slope = edges.reduce((sum,p)=>sum+(p.x-mx)*(p.y-my),0)/edges.reduce((sum,p)=>sum+(p.x-mx)**2,0);
      const residual = edges.reduce((sum,p)=>sum+(p.y-my-slope*(p.x-mx))**2,0)/edges.length;
      if (residual < 4) rollDegrees = Math.atan(slope)*180/Math.PI;
    }
    return { brightness: total / gray.length, rollDegrees };
  }

  function cameraAdvice(scene, points) {
    if (scene.brightness < 55) return 'Add light in front of you so the camera can see your hands clearly.';
    if (scene.brightness > 225) return 'Reduce glare or turn away from the bright window behind your hands.';
    if (scene.rollDegrees !== null && Math.abs(scene.rollDegrees) > 5 && Math.abs(scene.rollDegrees) < 25) return 'A strong room edge looks slanted. If it should be horizontal, rotate the camera until it looks level.';
    if (!points.length) return 'Angle the camera toward your playing surface, then show both hands above it. Keep the drums in the lower half of the preview.';
    if (points.some(p=>p.x < 0.05 || p.x > 0.95)) return 'Move the camera farther back or center it on your hands so both fit with room to move.';
    if (points.some(p=>p.y > 0.9)) return 'Tilt the camera down slightly: your hands are touching the bottom edge of the preview.';
    if (points.some(p=>p.y < 0.1)) return 'Tilt the camera up slightly: your hands are touching the top edge of the preview.';
    if (points.every(p=>p.y < 0.4)) return 'Tilt the camera up a little to bring your hands lower in the preview, toward the drums.';
    return 'Framing looks usable. Keep the camera steady and leave space above each drum for your hands.';
  }

  const api = { perspectiveScale, analyzeRoom, cameraAdvice };
  if (typeof module !== 'undefined') module.exports = api;
  else root.DrumSceneGuide = api;
})(globalThis);
