import './performance.js';

const find = selector => document.querySelector(selector);
const sidebar = find('aside');
const performancePanel = find('.performance');
const setup = find('#gettingStarted');
const chat = find('.chat-panel');
const stageColumn = find('.stage-column');

function section(title, description, expandable = false) {
  const element = document.createElement(expandable ? 'details' : 'section');
  element.className = 'studio-section';
  const heading = document.createElement(expandable ? 'summary' : 'h3');
  heading.textContent = title;
  element.append(heading);
  if (description) {
    const copy = document.createElement('p');
    copy.className = 'section-description';
    copy.textContent = description;
    element.append(copy);
  }
  return element;
}

function move(target, selectors) {
  for (const selector of selectors) {
    const element = find(selector);
    if (element) target.append(element);
  }
}

setup.querySelector('h3').textContent = 'Your first beat';
find('#step-hit .step-text').textContent = 'Start tracking or tap a drum';
sidebar.prepend(setup);
const modes = find('.modes');
find('.camera-panel').before(modes);
modes.after(find('#modeHelp'));
const playing = section('Play controls', 'Enable sound, then start tracking with both open hands in view.');
performancePanel.before(playing);
playing.classList.add('performance');
move(playing, ['#soundOn', '#trackToggle', '#trackingStatus']);
playing.append(find('#volume').closest('label'));
move(playing, ['.readouts', '.test-pads']);
const instructions = section('How to strike', 'Strike down onto the drumhead with three fingertips or your palm. Lift clear before the next hit.', true);
playing.append(instructions);
const tracking = section('Tracking settings', '', true);
move(tracking, ['#inputMode', '#setupHands', '#handRadiusControl', '#backendSettings', '#speedStatus']);
const inputLabel = document.createElement('label');
inputLabel.textContent = 'Input source';
inputLabel.append(find('#inputMode'));
tracking.prepend(inputLabel);
move(tracking, ['#inputHelp']);
playing.append(tracking);
const kit = section('Kit & camera', 'Switch to Arrange to position your drums.', true);
move(kit, ['.camera-coach', '.visual-controls', '.kit-heading', '.kit', '#reset']);
sidebar.append(kit);
const practice = section('Practice & insights', 'Keep time, record a session, and review your progress.', true);
const tempoLabel = find('#bpm').closest('label');
practice.append(tempoLabel);
move(practice, ['#metro', '#record', '#download', '#feedback', '#coachBanner', '#insightsPanel']);
sidebar.append(practice);
performancePanel.remove();
for (const selector of [':scope > .step-label', ':scope > h2', ':scope > .aside-copy', ':scope > .help', ':scope > .note', ':scope > .backend']) {
  sidebar.querySelector(selector)?.remove();
}
find('.visual-controls > p:last-child').textContent = 'Drag drums into reach. Adjust size and angle to match your view. Reposition the kit if you move the camera.';
find('.camera-coach small').textContent = 'Lighting and framing guidance. Video stays on your device.';
find('#inputHelp').textContent = 'Hold both hands open to select them. Each drum has a 0.1-second repeat guard.';
find('#insightsPanel h3').textContent = 'Your progress';
find('.workspace').append(sidebar);
stageColumn.append(chat);
