// The painter: floor, walls, crates, relics, the exit, the guards with their
// vision cones, the player and the HUD, then the title, pause, caught and
// win screens over it. A vision cone is a polygon built by marching rays
// across the cone until each one hits a wall, so the light stops where the
// walls do — a guard cannot see through a crate.

import { FIELD, GUARD, PALETTE, PEBBLE, TILE } from './config.js';
import { blocksTile, tileCentre } from './levels.js';
import { STATE_CHASE, STATE_INVESTIGATE, STATE_SEARCH, STATE_STARE, anyChasing, maxDetection } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const CONE_RAYS = 26;

/** The visible region of a guard's cone, as a polygon, cut off by walls. */
function conePolygon(guard, tiles) {
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= CONE_RAYS; i += 1) {
    const angle = guard.dir - GUARD.halfCone + (2 * GUARD.halfCone * i) / CONE_RAYS;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let dist = 0;
    let x = guard.x;
    let y = guard.y;
    while (dist < GUARD.sightRange) {
      const step = Math.min(6, GUARD.sightRange - dist);
      x += dx * step;
      y += dy * step;
      dist += step;
      const col = Math.floor(x / TILE);
      const row = Math.floor((y - FIELD.hudHeight) / TILE);
      if (blocksTile(tiles, col, row)) break;
    }
    points.push({ x, y });
  }
  return points;
}

function coneColors(guard) {
  if (guard.state === STATE_CHASE) return { fill: PALETTE.coneAlarm, edge: 'rgba(229, 83, 75, 0.55)' };
  if (guard.state === STATE_STARE || guard.state === STATE_INVESTIGATE || guard.state === STATE_SEARCH) {
    return { fill: PALETTE.coneSuspect, edge: 'rgba(242, 140, 60, 0.5)' };
  }
  return { fill: PALETTE.coneCalm, edge: PALETTE.coneCalmEdge };
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawFloor(tiles) {
    for (let row = 0; row < tiles.length; row += 1) {
      for (let col = 0; col < tiles[row].length; col += 1) {
        const kind = tiles[row][col];
        const x = col * TILE;
        const y = FIELD.hudHeight + row * TILE;
        if (kind === 'wall') continue;
        const dark = kind === 'dark';
        const alt = (col + row) % 2 === 0;
        ctx.fillStyle = dark ? (alt ? PALETTE.darkFloor : PALETTE.darkFloorAlt) : (alt ? PALETTE.floor : PALETTE.floorAlt);
        ctx.fillRect(x, y, TILE, TILE);
        if (dark) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
          ctx.fillRect(x, y, TILE, TILE);
        }
      }
    }
  }

  function drawWalls(tiles) {
    for (let row = 0; row < tiles.length; row += 1) {
      for (let col = 0; col < tiles[row].length; col += 1) {
        const kind = tiles[row][col];
        const x = col * TILE;
        const y = FIELD.hudHeight + row * TILE;
        if (kind === 'wall') {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(x, y, TILE, 5);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
        } else if (kind === 'crate') {
          ctx.fillStyle = PALETTE.crate;
          ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = PALETTE.crateTop;
          ctx.fillRect(x + 3, y + 3, TILE - 6, 5);
          ctx.strokeStyle = PALETTE.crateLine;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
          ctx.beginPath();
          ctx.moveTo(x + 3, y + 3);
          ctx.lineTo(x + TILE - 3, y + TILE - 3);
          ctx.moveTo(x + TILE - 3, y + 3);
          ctx.lineTo(x + 3, y + TILE - 3);
          ctx.stroke();
        }
      }
    }
  }

  function drawRelics(state) {
    const pulse = 0.75 + 0.25 * Math.sin(state.clock * 3);
    for (const relic of state.relics) {
      if (relic.taken) continue;
      const centre = tileCentre(relic.col, relic.row);
      ctx.save();
      ctx.translate(centre.x, centre.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.artifact;
      ctx.globalAlpha = pulse;
      const size = 9;
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#8a6d1f';
      ctx.lineWidth = 2;
      ctx.strokeRect(-size, -size, size * 2, size * 2);
      ctx.restore();
      ctx.fillStyle = 'rgba(242, 201, 76, 0.25)';
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, 20 + 4 * Math.sin(state.clock * 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawExit(state) {
    if (!state.exit) return;
    const centre = tileCentre(state.exit.col, state.exit.row);
    ctx.fillStyle = state.exitOpen ? PALETTE.exit : PALETTE.exitLocked;
    ctx.fillRect(centre.x - 14, centre.y - 14, 28, 28);
    ctx.strokeStyle = state.exitOpen ? '#1f7a4d' : '#39415a';
    ctx.lineWidth = 2;
    ctx.strokeRect(centre.x - 14, centre.y - 14, 28, 28);
    ctx.fillStyle = state.exitOpen ? '#0b2e1d' : '#20242e';
    ctx.font = 'bold 15px ' + 'system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.exitOpen ? '→' : '✕', centre.x, centre.y + 1);
    if (state.exitOpen) {
      ctx.fillStyle = `rgba(61, 220, 132, ${0.14 + 0.08 * Math.sin(state.clock * 3)})`;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, 30, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCones(state) {
    for (const guard of state.guards) {
      const colors = coneColors(guard);
      const polygon = conePolygon(guard, state.tiles);
      ctx.beginPath();
      ctx.moveTo(polygon[0].x, polygon[0].y);
      for (let i = 1; i < polygon.length; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
      ctx.closePath();
      ctx.fillStyle = colors.fill;
      ctx.fill();
      ctx.strokeStyle = colors.edge;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(guard.x + 2, guard.y + 3, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.guardSuit;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7e2f2a';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Facing tick.
      ctx.strokeStyle = '#ffd9d6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.lineTo(guard.x + Math.cos(guard.dir) * (GUARD.radius + 5), guard.y + Math.sin(guard.dir) * (GUARD.radius + 5));
      ctx.stroke();
      // Detection arc above the guard.
      if (guard.detection > 0.03) {
        ctx.strokeStyle = guard.detection >= 1 ? PALETTE.danger : guard.detection >= 0.45 ? '#f28c3c' : PALETTE.artifact;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y, GUARD.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * guard.detection);
        ctx.stroke();
      }
      // "?" while suspicious, "!" while chasing.
      if (guard.state === STATE_CHASE) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('!', guard.x, guard.y - GUARD.radius - 8);
      } else if (guard.state === STATE_STARE || guard.state === STATE_INVESTIGATE || guard.state === STATE_SEARCH) {
        if (guard.detection >= 0.45 || guard.state === STATE_STARE) {
          ctx.fillStyle = '#ffd9a0';
          ctx.font = 'bold 18px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText('?', guard.x, guard.y - GUARD.radius - 8);
        }
      }
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.arc(player.x + 2, player.y + 3, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = player.sneaking ? '#7d8aa5' : PALETTE.playerRing;
    ctx.lineWidth = 2;
    if (player.sneaking) ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#3a4152';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(player.dir) * 15, player.y + Math.sin(player.dir) * 15);
    ctx.stroke();
  }

  function drawPebbles(state) {
    for (const ring of state.pebbleRings) {
      const progress = 1 - ring.ttl / 0.9;
      ctx.strokeStyle = `rgba(238, 241, 245, ${0.7 * (1 - progress)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, 8 + progress * PEBBLE.noiseRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const flight of state.pebbleFlights) {
      ctx.fillStyle = '#cfd6e4';
      ctx.beginPath();
      ctx.arc(flight.x, flight.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawAim(state, mouse) {
    if (!mouse || !mouse.inside) return;
    const player = state.player;
    const dist = Math.hypot(mouse.x - player.x, mouse.y - player.y);
    if (dist > PEBBLE.range || state.pebbles <= 0) return;
    ctx.strokeStyle = 'rgba(238, 241, 245, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouse.x - 14, mouse.y);
    ctx.lineTo(mouse.x + 14, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 14);
    ctx.lineTo(mouse.x, mouse.y + 14);
    ctx.stroke();
  }

  function drawHud(state, screen, best) {
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, 0, FIELD.width, FIELD.hudHeight);
    ctx.fillStyle = PALETTE.hudLine;
    ctx.fillRect(0, FIELD.hudHeight - 2, FIELD.width, 2);
    ctx.fillStyle = PALETTE.text;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('THE QUIET GALLERY', 20, 26);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`${state.level.name}  ·  ${state.levelIndex + 1} of 3`, 20, 54);
    // Relics.
    const taken = state.relics.filter((relic) => relic.taken).length;
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.artifact;
    ctx.fillText(`◆ ${taken} / ${state.relics.length}`, 560, 30);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('relics', 560, 56);
    // Pebbles.
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`● ${state.pebbles}`, 680, 30);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('pebbles (Q / click)', 680, 56);
    // Attempts.
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`♥ ${state.attempts}`, 830, 30);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('attempts', 830, 56);
    // Timer.
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(formatTime(state.totalTimeMs), 950, 30);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('time', 950, 56);
    // The eye: how close the guards are to spotting you.
    const detection = maxDetection(state.guards);
    const chasing = anyChasing(state.guards);
    const eyeX = 1120;
    const eyeY = 40;
    ctx.strokeStyle = chasing ? PALETTE.danger : detection >= 0.45 ? '#f28c3c' : PALETTE.muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 20, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = chasing ? PALETTE.danger : detection >= 0.45 ? '#f28c3c' : PALETTE.muted;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 3 + 5 * detection, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(chasing ? 'SPOTTED' : detection >= 0.45 ? 'suspicious' : 'unseen', eyeX, 66);
    if (best > 0 && screen === SCREEN_TITLE) {
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(`best ghost run ${formatTime(best)}`, 1260, 54);
    }
  }

  function drawMessage(state) {
    if (!state.message || state.clock >= state.messageUntil) return;
    ctx.font = '17px system-ui, sans-serif';
    const width = ctx.measureText(state.message).width + 36;
    const x = (FIELD.width - width) / 2;
    const y = FIELD.hudHeight + 14;
    ctx.fillStyle = 'rgba(10, 12, 18, 0.82)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, 34, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.message, FIELD.width / 2, y + 18);
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8, 10, 15, 0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent || PALETTE.text;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(title, FIELD.width / 2, 250);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '19px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, FIELD.width / 2, 310 + i * 30);
    });
  }

  function drawAlarmFrame(state) {
    if (!anyChasing(state.guards)) return;
    const pulse = 0.25 + 0.15 * Math.sin(state.clock * 6);
    ctx.strokeStyle = `rgba(229, 83, 75, ${pulse})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, FIELD.hudHeight + 5, FIELD.width - 10, FIELD.height - FIELD.hudHeight - 10);
  }

  return {
    draw(state, screen, best, mouse) {
      ctx.clearRect(0, 0, FIELD.width, FIELD.height);
      ctx.fillStyle = PALETTE.backdrop;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      drawHud(state, screen, best);
      drawFloor(state.tiles);
      drawCones(state);
      drawRelics(state);
      drawExit(state);
      drawWalls(state.tiles);
      drawPebbles(state);
      drawGuards(state);
      drawPlayer(state);
      if (screen === SCREEN_PLAY) drawAim(state, mouse);
      drawMessage(state);
      drawAlarmFrame(state);
      if (screen === SCREEN_TITLE) {
        overlay('THE QUIET GALLERY', [
          'A museum after dark. Lift three relics from each gallery, then reach the east door unseen.',
          'WASD or arrows to move · hold Shift to sneak · Q or click to throw a pebble',
          'Gold cones are watching. Dark floor hides you. A full eye means the chase is on.',
          '',
          'Press Space or click to start',
        ]);
      } else if (screen === SCREEN_PAUSED) {
        overlay('PAUSED', ['Press P or Space to keep sneaking.']);
      } else if (screen === SCREEN_OVER) {
        overlay('CAUGHT OUT', [
          `The guards walk you out after ${state.spotted} ${state.spotted === 1 ? 'spotting' : 'spottings'}.`,
          'Press Space to try the gallery again',
        ], PALETTE.danger);
      } else if (screen === SCREEN_WIN) {
        const ghost = state.spotted === 0;
        overlay(ghost ? 'GHOST — NEVER SEEN' : 'THE GALLERY IS YOURS', [
          `All three galleries cleared in ${formatTime(state.totalTimeMs)}.`,
          ghost ? 'Not one guard ever knew you were there.' : `${state.spotted} ${state.spotted === 1 ? 'spotting' : 'spottings'} along the way.`,
          'Press Space to play again',
        ], PALETTE.ok);
      }
    },
  };
}
