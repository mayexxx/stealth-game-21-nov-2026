// The simulation: one level at a time, the player, the pebbles, the relics,
// the exit and the attempts. The world advances in fixed steps and reports
// what happened as event flags, so the loop can play sounds and switch
// screens without knowing how the rules work.

import { ATTEMPTS, PEBBLE, PLAYER } from './config.js';
import { LEVELS, parseLevel, tileAt, tileCentre } from './levels.js';
import { createGuard, updateGuards } from './guards.js';
import { moveCircle } from './physics.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_ALERT = 2;
export const EVENT_SUSPICIOUS = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_DOOR = 16;
export const EVENT_LEVEL_CLEAR = 32;
export const EVENT_WIN = 64;
export const EVENT_GAME_OVER = 128;

const NO_AUDIO = {
  footstep() {},
  guardStep() {},
  suspicious() {},
  alert() {},
  pickup() {},
  toss() {},
  caught() {},
  door() {},
  win() {},
  unlock() {},
  setMuted() {},
  isMuted() {
    return false;
  },
};

export function createWorld(random, audio = NO_AUDIO) {
  const state = {
    random,
    audio,
    levelIndex: 0,
    level: null,
    tiles: [],
    player: { x: 0, y: 0, dir: 0, moving: false, sneaking: false, stepTimer: 0 },
    guards: [],
    relics: [],
    exit: null,
    exitOpen: false,
    pebbles: PEBBLE.startCount,
    pebbleFlights: [],
    pebbleRings: [],
    attempts: ATTEMPTS,
    spotted: 0,
    clock: 0,
    levelTimeMs: 0,
    totalTimeMs: 0,
    message: null,
    messageUntil: 0,
    over: false,
    won: false,
  };

  function loadLevel(index) {
    const def = LEVELS[index];
    const parsed = parseLevel(def);
    state.levelIndex = index;
    state.level = def;
    state.tiles = parsed.tiles;
    state.relics = parsed.relics;
    state.exit = parsed.exit;
    state.exitOpen = false;
    state.pebbles = PEBBLE.startCount;
    state.pebbleFlights = [];
    state.pebbleRings = [];
    state.levelTimeMs = 0;
    const start = tileCentre(parsed.player.col, parsed.player.row);
    state.player.x = start.x;
    state.player.y = start.y;
    state.player.dir = 0;
    state.player.moving = false;
    state.guards = def.patrols.map((waypoints) => createGuard(waypoints));
  }

  function showMessage(text, seconds) {
    state.message = text;
    state.messageUntil = state.clock + seconds;
  }

  function resetPlayer() {
    const parsed = parseLevel(state.level);
    const start = tileCentre(parsed.player.col, parsed.player.row);
    state.player.x = start.x;
    state.player.y = start.y;
    state.player.dir = 0;
    state.guards = state.level.patrols.map((waypoints) => createGuard(waypoints));
    state.pebbleFlights = [];
  }

  function step(dt, move, sneaking, actions, throwTarget) {
    if (state.over || state.won) return EVENT_NONE;
    let events = EVENT_NONE;
    state.clock += dt;
    state.levelTimeMs += dt * 1000;
    state.totalTimeMs += dt * 1000;

    const player = state.player;
    const speed = sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const moving = move.x !== 0 || move.y !== 0;
    player.moving = moving;
    player.sneaking = sneaking;
    if (moving) {
      player.dir = Math.atan2(move.y, move.x);
      const moved = moveCircle(state.tiles, player.x, player.y, PLAYER.radius, move.x * speed * dt, move.y * speed * dt);
      player.x = moved.x;
      player.y = moved.y;
      player.stepTimer -= dt;
      if (player.stepTimer <= 0) {
        player.stepTimer = sneaking ? 0.55 : 0.38;
        state.audio.footstep(sneaking);
      }
    }

    // A thrown pebble flies to its mark, then rings out a noise.
    const heardNoises = [];
    if (!sneaking && moving) {
      heardNoises.push({ x: player.x, y: player.y, radius: PLAYER.noiseRadius });
    }
    for (let i = state.pebbleFlights.length - 1; i >= 0; i -= 1) {
      const flight = state.pebbleFlights[i];
      flight.t += dt / flight.dur;
      if (flight.t >= 1) {
        state.pebbleFlights.splice(i, 1);
        state.pebbleRings.push({ x: flight.tx, y: flight.ty, ttl: 0.9 });
        heardNoises.push({ x: flight.tx, y: flight.ty, radius: PEBBLE.noiseRadius });
      } else {
        flight.x = flight.x + (flight.tx - flight.x) * Math.min(1, dt * 10);
        flight.y = flight.y + (flight.ty - flight.y) * Math.min(1, dt * 10);
      }
    }
    for (let i = state.pebbleRings.length - 1; i >= 0; i -= 1) {
      state.pebbleRings[i].ttl -= dt;
      if (state.pebbleRings[i].ttl <= 0) state.pebbleRings.splice(i, 1);
    }

    if (actions.throw && throwTarget && state.pebbles > 0) {
      const dx = throwTarget.x - player.x;
      const dy = throwTarget.y - player.y;
      const dist = Math.hypot(dx, dy);
      const clamped = dist > PEBBLE.range ? PEBBLE.range / dist : 1;
      const tx = player.x + dx * clamped;
      const ty = player.y + dy * clamped;
      state.pebbleFlights.push({ x: player.x, y: player.y, tx, ty, t: 0, dur: Math.max(0.25, dist / 520) });
      state.pebbles -= 1;
      state.audio.toss();
    }

    const guardEvents = updateGuards(state.guards, {
      tiles: state.tiles,
      player,
      sneaking,
      moving,
      noises: heardNoises,
      audio: state.audio,
    }, dt);
    if (guardEvents.alerted) {
      events |= EVENT_ALERT;
      state.audio.alert();
      showMessage('Spotted — break line of sight!', 2.2);
    }
    if (guardEvents.suspicious) {
      events |= EVENT_SUSPICIOUS;
      state.audio.suspicious();
    }

    // Relics are picked up by walking over them.
    for (const relic of state.relics) {
      if (relic.taken) continue;
      const centre = tileCentre(relic.col, relic.row);
      if (Math.hypot(player.x - centre.x, player.y - centre.y) < 26) {
        relic.taken = true;
        events |= EVENT_PICKUP;
        state.audio.pickup();
        const taken = state.relics.filter((item) => item.taken).length;
        if (taken >= state.relics.length) {
          state.exitOpen = true;
          events |= EVENT_DOOR;
          state.audio.door();
          showMessage('All relics lifted — the east door is open.', 3);
        } else {
          showMessage(`Relic ${taken} of ${state.relics.length} lifted.`, 2);
        }
      }
    }

    // Caught: lose an attempt and start the level's patrols over.
    if (guardEvents.caught) {
      events |= EVENT_CAUGHT;
      state.audio.caught();
      state.attempts -= 1;
      state.spotted += 1;
      if (state.attempts <= 0) {
        state.over = true;
        events |= EVENT_GAME_OVER;
      } else {
        resetPlayer();
        showMessage(`Caught! ${state.attempts} ${state.attempts === 1 ? 'attempt' : 'attempts'} left.`, 2.5);
      }
      return events;
    }

    // The exit, once open, ends the level.
    if (state.exitOpen && state.exit) {
      const centre = tileCentre(state.exit.col, state.exit.row);
      if (Math.hypot(player.x - centre.x, player.y - centre.y) < 26) {
        if (state.levelIndex + 1 >= LEVELS.length) {
          state.won = true;
          events |= EVENT_WIN;
          state.audio.win();
        } else {
          events |= EVENT_LEVEL_CLEAR;
          loadLevel(state.levelIndex + 1);
          showMessage(LEVELS[state.levelIndex].briefing, 4);
        }
      }
    }
    return events;
  }

  function reset() {
    state.attempts = ATTEMPTS;
    state.spotted = 0;
    state.totalTimeMs = 0;
    state.over = false;
    state.won = false;
    state.message = null;
    loadLevel(0);
    showMessage(LEVELS[0].briefing, 4);
  }

  loadLevel(0);
  showMessage(LEVELS[0].briefing, 4);

  return {
    state,
    step,
    reset,
    loadLevel,
    showMessage,
    relicsTaken() {
      return state.relics.filter((item) => item.taken).length;
    },
  };
}
