// The screenshot scenes behind ?shot=start|play|alarm|escape. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a small autopilot (a BFS pathfinder that walks to the next
// relic, then the exit, always sneaking, and backs away whenever a guard's
// detection climbs), so the frame is what a short game really looks like and
// the same seed always gives the same frame.

import { STEP } from './config.js';
import { EVENT_ALERT, EVENT_CAUGHT, EVENT_GAME_OVER, EVENT_LEVEL_CLEAR } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { tileCentre, tileOf } from './levels.js';
import { guardSees, maxDetection } from './guards.js';

const SAMPLE = STEP;
const START_SECONDS = 5;
const PLAY_SECONDS = 16;
const ALARM_LIMIT_SECONDS = 120;
const ESCAPE_LIMIT_SECONDS = 300;

/** Breadth-first path over floor tiles, from one tile to another. */
function findPath(tiles, from, to) {
  const rows = tiles.length;
  const cols = tiles[0].length;
  const passable = (col, row) => {
    if (col < 0 || col >= cols || row < 0 || row >= rows) return false;
    const kind = tiles[row][col];
    return kind === 'floor' || kind === 'dark';
  };
  if (!passable(to.col, to.row)) return null;
  const key = (col, row) => row * cols + col;
  const cameFrom = new Map();
  const queue = [from];
  cameFrom.set(key(from.col, from.row), null);
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.col === to.col && cur.row === to.row) {
      const path = [];
      let node = cur;
      while (node) {
        path.unshift(node);
        node = cameFrom.get(key(node.col, node.row));
      }
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { col: cur.col + dc, row: cur.row + dr };
      if (!passable(next.col, next.row)) continue;
      if (cameFrom.has(key(next.col, next.row))) continue;
      cameFrom.set(key(next.col, next.row), cur);
      queue.push(next);
    }
  }
  return null;
}

/**
 * Steer the player one step. Follows `path` (a list of tiles) toward its end,
 * but backs away from the guard whose detection is climbing, so the pilot
 * survives the cones it has to cross. Returns {x, y} steering and whether
 * the path is finished.
 */
export function autopilot(world, path) {
  const state = world.state;
  const player = state.player;
  const detection = maxDetection(state.guards);
  if (detection > 0.3) {
    // Back away from the most suspicious guard.
    let worst = null;
    let worstDetection = 0;
    for (const guard of state.guards) {
      if (guard.detection > worstDetection) {
        worstDetection = guard.detection;
        worst = guard;
      }
    }
    if (worst) {
      const dx = player.x - worst.x;
      const dy = player.y - worst.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: dx / len, y: dy / len, done: false };
    }
  }
  if (!path || path.length === 0) return { x: 0, y: 0, done: true };
  // If the next step is watched, wait for the cone to pass instead of
  // walking into it: a patient thief crosses when the guard looks away.
  const next = tileCentre(path[0].col, path[0].row);
  for (const guard of state.guards) {
    if (guardSees(guard, next.x, next.y, state.tiles)) {
      return { x: 0, y: 0, done: false };
    }
  }
  const target = path[0];
  const centre = tileCentre(target.col, target.row);
  const dx = centre.x - player.x;
  const dy = centre.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) {
    path.shift();
    return { x: 0, y: 0, done: path.length === 0 };
  }
  return { x: dx / dist, y: dy / dist, done: false };
}

/** Next relic the pilot should steal, nearest first. */
export function nextRelicTarget(world) {
  const state = world.state;
  const player = state.player;
  let best = null;
  let bestDist = Infinity;
  for (const relic of state.relics) {
    if (relic.taken) continue;
    const centre = tileCentre(relic.col, relic.row);
    const dist = Math.hypot(centre.x - player.x, centre.y - player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = relic;
    }
  }
  return best;
}

export function replanPath(world, targetTile) {
  const state = world.state;
  const from = tileOf(state.player.x, state.player.y);
  const path = findPath(state.tiles, from, targetTile);
  if (path) path.shift();
  return path;
}

function stepWorld(world, move, sneak = true) {
  return world.step(SAMPLE, { x: move.x, y: move.y }, sneak, { throw: false }, null);
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best time to show. Names: start, play, alarm, escape; anything else
 * is start.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;

  if (name !== 'play' && name !== 'alarm' && name !== 'escape') {
    for (let i = 0; i < START_SECONDS / SAMPLE; i += 1) {
      world.step(SAMPLE, { x: 0, y: 0 }, false, { throw: false }, null);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'play') {
    let path = null;
    let target = nextRelicTarget(world);
    if (target) path = replanPath(world, { col: target.col, row: target.row });
    let replanIn = 0;
    for (let i = 0; i < PLAY_SECONDS / SAMPLE; i += 1) {
      replanIn -= 1;
      if (replanIn <= 0) {
        target = nextRelicTarget(world);
        if (target) path = replanPath(world, { col: target.col, row: target.row });
        replanIn = 30;
      }
      const move = autopilot(world, path);
      stepWorld(world, move);
      if (state.over) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'alarm') {
    // Walk straight at the first guard at full speed until the chase starts,
    // then run away at full speed and freeze the frame mid-chase: the guard
    // is slower than a running player, so it cannot catch up in that window.
    let alerted = false;
    let runFor = 0;
    for (let i = 0; i < ALARM_LIMIT_SECONDS / SAMPLE; i += 1) {
      const guard = state.guards[0];
      let move;
      if (!alerted) {
        // Aim for a point in front of the guard, so the walk crosses the
        // cone head-on instead of sneaking up from behind it.
        const tx = guard.x + Math.cos(guard.dir) * 100;
        const ty = guard.y + Math.sin(guard.dir) * 100;
        const dx = tx - state.player.x;
        const dy = ty - state.player.y;
        const len = Math.hypot(dx, dy) || 1;
        move = { x: dx / len, y: dy / len };
      } else {
        const dx = state.player.x - guard.x;
        const dy = state.player.y - guard.y;
        const len = Math.hypot(dx, dy) || 1;
        move = { x: dx / len, y: dy / len };
        runFor -= 1;
        if (runFor <= 0) break;
      }
      const events = stepWorld(world, move, false);
      if (events & EVENT_ALERT) {
        alerted = true;
        runFor = Math.round(0.8 / SAMPLE);
      }
      if (events & (EVENT_CAUGHT | EVENT_GAME_OVER)) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  // escape: steal every relic, then stop one step short of the open exit.
  let path = null;
  let target = nextRelicTarget(world);
  if (target) path = replanPath(world, { col: target.col, row: target.row });
  let replanIn = 0;
  for (let i = 0; i < ESCAPE_LIMIT_SECONDS / SAMPLE; i += 1) {
    if (state.exitOpen && state.exit) {
      const centre = tileCentre(state.exit.col, state.exit.row);
      if (Math.hypot(state.player.x - centre.x, state.player.y - centre.y) < 42) break;
      if (!path || path.length === 0) {
        path = replanPath(world, { col: state.exit.col, row: state.exit.row });
      }
    } else {
      replanIn -= 1;
      if (replanIn <= 0) {
        target = nextRelicTarget(world);
        if (target) path = replanPath(world, { col: target.col, row: target.row });
        replanIn = 30;
      }
    }
    const move = autopilot(world, path);
    const events = stepWorld(world, move);
    if (events & EVENT_LEVEL_CLEAR) break;
    if (events & EVENT_GAME_OVER) break;
    if (state.over) break;
  }
  return { screen: SCREEN_PLAY, best: 0 };
}
