// Every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area: an 80px HUD bar on top, then a 40x20 tile gallery
// below it (tile 32px). The renderer scales the logical area to the window,
// so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720, hudHeight: 80 };
export const TILE = 32;
export const COLS = 40;
export const ROWS = 20;
export const PLAY_TOP = FIELD.hudHeight;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 11,
  walkSpeed: 178,
  sneakSpeed: 96,
  /** Noise radius while walking; sneaking is silent. */
  noiseRadius: 78,
};

export const GUARD = {
  radius: 12,
  patrolSpeed: 72,
  searchSpeed: 96,
  chaseSpeed: 142,
  /** How far a guard can see, in pixels. */
  sightRange: 235,
  /** Half of the vision cone's angle, in radians. */
  halfCone: 0.62,
  /** Detection 0..1 gained per second at point blank, scaled by distance. */
  detectRate: 1.25,
  /** Detection lost per second while the player is unseen. */
  forgetRate: 0.45,
  /** Detection level where a guard gets suspicious and turns to look. */
  suspectAt: 0.45,
  /** Seconds a guard stares before walking over to investigate. */
  stareTime: 0.7,
  /** Seconds of no sight before an alarmed guard gives up the chase. */
  loseSightTime: 4,
  /** Seconds a guard searches the last seen spot before returning to patrol. */
  searchTime: 3.5,
  /** How far a guard hears a footstep or a thrown pebble, in pixels. */
  hearRange: 260,
};

export const PEBBLE = {
  startCount: 3,
  /** How far a pebble can be thrown, in pixels. */
  range: 320,
  /** Noise radius where it lands. */
  noiseRadius: 240,
};

export const ATTEMPTS = 3;

export const PALETTE = {
  backdrop: '#0b0d12',
  hud: '#141824',
  hudLine: '#2a3040',
  floor: '#232833',
  floorAlt: '#20252f',
  darkFloor: '#171b25',
  darkFloorAlt: '#151922',
  wall: '#3d465c',
  wallTop: '#4d5878',
  crate: '#6b5433',
  crateTop: '#8a6f45',
  crateLine: '#4a3a22',
  artifact: '#f2c94c',
  exit: '#3ddc84',
  exitLocked: '#5a6478',
  player: '#e8e4d8',
  playerRing: '#f2c94c',
  guard: '#e5534b',
  guardSuit: '#c94a44',
  coneCalm: 'rgba(242, 201, 76, 0.16)',
  coneCalmEdge: 'rgba(242, 201, 76, 0.35)',
  coneSuspect: 'rgba(242, 140, 60, 0.28)',
  coneAlarm: 'rgba(229, 83, 75, 0.34)',
  text: '#eef1f5',
  muted: '#9aa3b5',
  danger: '#ff6b61',
  ok: '#3ddc84',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best (fastest ghost) time is kept between visits (this browser only). */
export const BEST_KEY = 'quiet-gallery.best-ms';
