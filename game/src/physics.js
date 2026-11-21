// Circle-against-tile movement and line of sight on the tile grid. One job:
// answer "can this circle be here" and "can these two points see each other"
// so the player and the guards share exactly the same collision rules.

import { blocksTile } from './levels.js';

/** True when a circle of `radius` at (x, y) overlaps a blocking tile. */
export function circleHitsWall(tiles, x, y, radius) {
  const left = Math.floor((x - radius) / 32);
  const right = Math.floor((x + radius) / 32);
  const top = Math.floor((y - 80 - radius) / 32);
  const bottom = Math.floor((y - 80 + radius) / 32);
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      if (!blocksTile(tiles, col, row)) continue;
      const tileLeft = col * 32;
      const tileTop = 80 + row * 32;
      const nearestX = Math.max(tileLeft, Math.min(x, tileLeft + 32));
      const nearestY = Math.max(tileTop, Math.min(y, tileTop + 32));
      const dx = x - nearestX;
      const dy = y - nearestY;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

/**
 * Move a circle by (dx, dy), sliding along walls: try x first, then y, so a
 * circle pushed into a corner slides along the wall instead of stopping.
 */
export function moveCircle(tiles, x, y, radius, dx, dy) {
  let nx = x;
  let ny = y;
  if (dx !== 0 && !circleHitsWall(tiles, x + dx, y, radius)) nx = x + dx;
  if (dy !== 0 && !circleHitsWall(tiles, nx, y + dy, radius)) ny = y + dy;
  return { x: nx, y: ny };
}

/**
 * True when nothing blocking stands between two points. Samples the segment
 * every 6 pixels and asks the tile under each sample.
 */
export function lineOfSight(tiles, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    const col = Math.floor(x / 32);
    const row = Math.floor((y - 80) / 32);
    if (blocksTile(tiles, col, row)) return false;
  }
  return true;
}

/** Angle from (x0, y0) to (x1, y1), in radians. */
export function angleTo(x0, y0, x1, y1) {
  return Math.atan2(y1 - y0, x1 - x0);
}

/** Smallest absolute difference between two angles, in radians. */
export function angleDiff(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff);
}

/** Move `angle` toward `target` by at most `maxStep` radians. */
export function turnToward(angle, target, maxStep) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return target;
  return angle + Math.sign(diff) * maxStep;
}
