export class HandInput {
  constructor(session, getPoints) {
    this.session = session;
    this.getPoints = getPoints;
    this.reset(0);
  }

  reset(now) {
    this.session.reset();
    this.lastSeen = now;
  }

  update(result, now) {
    const observations = result.landmarks.map((landmarks, index) => ({
      landmarks,
      handedness: result.handedness[index]?.[0]?.categoryName || 'Unknown',
      confidence: result.handedness[index]?.[0]?.score || 0,
      screenLandmarks: landmarks.map(point => ({ ...point, x: 1 - point.x })),
      worldLandmarks: result.worldLandmarks[index]
    }));
    const selection = this.session.update(observations, now);
    if (selection.hands.length || selection.previewHands.some(hand => this.getPoints(hand.landmarks).length)) this.lastSeen = now;
    const displayed = selection.state === 'calibrating' ? selection.previewHands : selection.hands;
    const overlayPoints = displayed.flatMap(hand => this.getPoints(hand.screenLandmarks).map(point => ({
      ...point,
      id: hand.id,
      color: selection.state === 'calibrating' ? '#f4d58b' : hand.id === 'hand-1' ? '#99f0c6' : '#a6b5ff',
      radius: point.name === 'palm' ? 8 : 5
    })));
    const strikePoints = selection.hands.flatMap(hand => this.getPoints(hand.screenLandmarks).map(point => ({
      id: `${hand.id}:${point.name}`, handId: hand.id, name: point.name, x: point.x, y: point.y
    })));
    return { ...selection, timestampMs: now, overlayPoints, strikePoints, timedOut: now - this.lastSeen >= 10000 };
  }
}
