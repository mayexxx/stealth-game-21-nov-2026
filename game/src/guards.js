// The guards: patrol rounds, vision cones, suspicion and the chase. A guard
// is a small state machine — patrol, stare, investigate, chase, search,
// return — and its detection meter is the game's heart: it fills while the
// player stands in the cone and drains while hidden, so a near miss is a
// warning, not a sentence.

import { GUARD, PLAYER } from './config.js';
import { tileAt, tileCentre } from './levels.js';
import { angleDiff, angleTo, lineOfSight, moveCircle, turnToward } from './physics.js';

export const STATE_PATROL = 'patrol';
export const STATE_STARE = 'stare';
export const STATE_INVESTIGATE = 'investigate';
export const STATE_CHASE = 'chase';
export const STATE_SEARCH = 'search';
export const STATE_RETURN = 'return';

export function createGuard(waypoints) {
  const points = waypoints.map(([col, row]) => tileCentre(col, row));
  const start = points[0];
  const next = points[1] || points[0];
  return {
    x: start.x,
    y: start.y,
    dir: angleTo(start.x, start.y, next.x, next.y),
    waypoints: points,
    waypointIndex: 1 % points.length,
    state: STATE_PATROL,
    detection: 0,
    waitTimer: 0,
    stareTimer: 0,
    loseTimer: 0,
    searchTimer: 0,
    scanTimer: 0,
    scanDir: 1,
    lastSeen: null,
    target: null,
    stepTimer: 0,
    moving: false,
  };
}

/** True when the guard can see the point (range, cone and a clear line). */
export function guardSees(guard, x, y, tiles) {
  const dx = x - guard.x;
  const dy = y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.sightRange) return false;
  if (angleDiff(guard.dir, angleTo(guard.x, guard.y, x, y)) > GUARD.halfCone) return false;
  return lineOfSight(tiles, guard.x, guard.y, x, y);
}

/** Walk toward a point; returns true when arrived (within 6 pixels). */
function walkTo(guard, target, speed, dt, tiles) {
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) return true;
  const step = Math.min(dist, speed * dt);
  const moved = moveCircle(tiles, guard.x, guard.y, GUARD.radius, (dx / dist) * step, (dy / dist) * step);
  guard.dir = angleTo(guard.x, guard.y, moved.x, moved.y);
  guard.x = moved.x;
  guard.y = moved.y;
  guard.moving = true;
  return dist - step < 6;
}

function nearestWaypointIndex(guard) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < guard.waypoints.length; i += 1) {
    const point = guard.waypoints[i];
    const dist = Math.hypot(point.x - guard.x, point.y - guard.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

function playStep(guard, ctx, dt, interval) {
  guard.stepTimer -= dt;
  if (guard.stepTimer > 0) return;
  guard.stepTimer = interval;
  const dist = Math.hypot(ctx.player.x - guard.x, ctx.player.y - guard.y);
  ctx.audio.guardStep(dist);
}

/**
 * Advance every guard one step. `ctx` carries the tiles, the player
 * (position, whether sneaking, whether moving), this step's noises and the
 * audio hooks. Returns { alerted, caught, suspicious } for this step.
 */
export function updateGuards(guards, ctx, dt) {
  const events = { alerted: false, caught: false, suspicious: false };
  const { tiles, player } = ctx;
  const playerTile = tileAt(tiles, Math.floor(player.x / 32), Math.floor((player.y - 80) / 32));
  const inDark = playerTile === 'dark';

  for (const guard of guards) {
    guard.moving = false;
    const sees = guardSees(guard, player.x, player.y, tiles);

    // --- detection meter ---
    if (sees) {
      const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
      let rate = GUARD.detectRate * (1 - 0.6 * (dist / GUARD.sightRange));
      if (ctx.sneaking) rate *= 0.55;
      if (inDark) rate *= 0.5;
      if (ctx.moving) rate *= 1.15;
      else rate *= 0.9;
      guard.detection = Math.min(1, guard.detection + rate * dt);
      guard.lastSeen = { x: player.x, y: player.y };
    } else {
      guard.detection = Math.max(0, guard.detection - GUARD.forgetRate * dt);
    }

    // --- full detection: the chase begins ---
    if (guard.detection >= 1 && guard.state !== STATE_CHASE) {
      guard.state = STATE_CHASE;
      guard.loseTimer = 0;
      events.alerted = true;
    }

    // --- noises: a footstep nearby or a pebble landing pulls a guard over ---
    if (guard.state !== STATE_CHASE) {
      for (const noise of ctx.noises) {
        const dist = Math.hypot(noise.x - guard.x, noise.y - guard.y);
        if (dist <= Math.min(noise.radius, GUARD.hearRange)) {
          guard.state = STATE_INVESTIGATE;
          guard.target = { x: noise.x, y: noise.y };
          guard.waitTimer = 0;
          break;
        }
      }
    }

    // --- state machine ---
    if (guard.state === STATE_PATROL) {
      if (guard.detection >= GUARD.suspectAt) {
        guard.state = STATE_STARE;
        guard.stareTimer = GUARD.stareTime;
        events.suspicious = true;
      } else if (guard.waitTimer > 0) {
        guard.waitTimer -= dt;
        guard.dir += guard.scanDir * 0.9 * dt;
        if (guard.waitTimer <= 0) guard.scanDir *= -1;
      } else {
        const target = guard.waypoints[guard.waypointIndex];
        if (walkTo(guard, target, GUARD.patrolSpeed, dt, tiles)) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
          guard.waitTimer = 0.45;
        }
        playStep(guard, ctx, dt, 0.5);
      }
    } else if (guard.state === STATE_STARE) {
      guard.dir = turnToward(guard.dir, angleTo(guard.x, guard.y, player.x, player.y), 3.5 * dt);
      guard.stareTimer -= dt;
      if (guard.detection < GUARD.suspectAt * 0.6) {
        guard.state = STATE_PATROL;
      } else if (guard.stareTimer <= 0) {
        guard.state = STATE_INVESTIGATE;
        guard.target = guard.lastSeen ? { ...guard.lastSeen } : { x: player.x, y: player.y };
        guard.waitTimer = 0;
      }
    } else if (guard.state === STATE_INVESTIGATE) {
      if (guard.detection >= GUARD.suspectAt) {
        guard.dir = turnToward(guard.dir, angleTo(guard.x, guard.y, player.x, player.y), 3.5 * dt);
      }
      if (guard.target && walkTo(guard, guard.target, GUARD.searchSpeed, dt, tiles)) {
        guard.state = STATE_SEARCH;
        guard.searchTimer = GUARD.searchTime;
        guard.scanTimer = 0;
      }
      playStep(guard, ctx, dt, 0.42);
    } else if (guard.state === STATE_CHASE) {
      if (sees) {
        guard.loseTimer = 0;
        guard.lastSeen = { x: player.x, y: player.y };
      } else {
        guard.loseTimer += dt;
      }
      const target = guard.lastSeen || { x: player.x, y: player.y };
      walkTo(guard, target, GUARD.chaseSpeed, dt, tiles);
      playStep(guard, ctx, dt, 0.3);
      if (guard.loseTimer > GUARD.loseSightTime) {
        guard.state = STATE_SEARCH;
        guard.searchTimer = GUARD.searchTime;
        guard.scanTimer = 0;
      }
      if (Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.radius + PLAYER.radius + 2) {
        events.caught = true;
      }
    } else if (guard.state === STATE_SEARCH) {
      guard.searchTimer -= dt;
      guard.scanTimer += dt;
      guard.dir += Math.sin(guard.scanTimer * 1.4) * 1.6 * dt;
      if (guard.detection >= GUARD.suspectAt && sees) {
        guard.state = STATE_STARE;
        guard.stareTimer = GUARD.stareTime;
      } else if (guard.searchTimer <= 0) {
        guard.state = STATE_RETURN;
      }
    } else if (guard.state === STATE_RETURN) {
      const index = nearestWaypointIndex(guard);
      const target = guard.waypoints[index];
      if (walkTo(guard, target, GUARD.patrolSpeed, dt, tiles)) {
        guard.waypointIndex = (index + 1) % guard.waypoints.length;
        guard.state = STATE_PATROL;
        guard.waitTimer = 0.3;
      }
      playStep(guard, ctx, dt, 0.5);
    }
  }
  return events;
}

/** Highest detection among the guards, 0..1. */
export function maxDetection(guards) {
  let max = 0;
  for (const guard of guards) max = Math.max(max, guard.detection);
  return max;
}

/** True when any guard is chasing. */
export function anyChasing(guards) {
  return guards.some((guard) => guard.state === STATE_CHASE);
}
