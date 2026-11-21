// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, caught and win.
//
// ?seed=N fixes the run. ?shot=start|play|alarm|escape (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_GAME_OVER, EVENT_LEVEL_CLEAR, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_THROW, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed), audio);
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best time then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { x: 0, y: 0, inside: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing ${world.state.level.name}. Lift three relics, then reach the east door.`);
  }

  function endGame(won) {
    if (won) {
      screen = SCREEN_WIN;
      if (world.state.spotted === 0 && (best === 0 || world.state.totalTimeMs < best)) {
        best = Math.round(world.state.totalTimeMs);
        saveBest(best);
      }
      announce('All three galleries cleared.');
    } else {
      screen = SCREEN_OVER;
      announce('Caught out. Press Space to try again.');
    }
  }

  function step(flags) {
    if (screen === SCREEN_TITLE) {
      // The gallery idles behind the title: guards walk their rounds.
      world.step(STEP, { x: 0, y: 0 }, false, { throw: false }, null);
      return;
    }
    const throwTarget = flags & ACTION_THROW ? input.takeThrowTarget() : null;
    const events = world.step(STEP, input.direction(), input.sneaking(), { throw: Boolean(flags & ACTION_THROW) }, throwTarget);
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_GAME_OVER) endGame(false);
    else if (events & EVENT_LEVEL_CLEAR) {
      announce(`Gallery cleared. Now ${world.state.level.name}.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One-shot presses are taken once per frame and handed to the steps, so
    // a throw queued between two frames is never lost and never counted twice.
    const flags = input.takeActions();
    if (flags & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (flags & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // A throw is a one-shot press: only the first catch-up step of the
      // frame may spend it, or one key press would throw several pebbles.
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? flags : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, input.mouse());
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Quiet Gallery. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
