// Keyboard and pointer input. Held keys give a steering direction; one-shot
// presses (start or restart, pause, throw) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost and never
// counted twice. The mouse position is kept in logical field coordinates so
// a pebble can be aimed at it.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_THROW = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const THROW = new Set(['KeyQ']);

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, sneak: false };
  let actions = 0;
  let mouse = { x: 0, y: 0, inside: false };
  let throwTarget = null;

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (SNEAK.has(event.code)) held.sneak = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (THROW.has(event.code)) {
      if (!event.repeat) {
        actions |= ACTION_THROW;
        throwTarget = { x: mouse.x, y: mouse.y };
      }
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (SNEAK.has(event.code)) held.sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.sneak = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    mouse = { ...toLogical(event), inside: true };
  });
  canvas.addEventListener('pointerleave', () => {
    mouse.inside = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse = { ...toLogical(event), inside: true };
    if (event.button === 2) {
      actions |= ACTION_THROW;
      throwTarget = { x: mouse.x, y: mouse.y };
    } else {
      actions |= ACTION_CONFIRM;
    }
    event.preventDefault();
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Steering direction as {x, y}, each -1, 0 or 1, normalised on read. */
    direction() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x !== 0 && y !== 0) {
        const scale = 1 / Math.SQRT2;
        return { x: x * scale, y: y * scale };
      }
      return { x, y };
    },
    sneaking() {
      return held.sneak;
    },
    mouse() {
      return mouse;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Where the last throw was aimed; null until a throw is queued. */
    takeThrowTarget() {
      const target = throwTarget;
      throwTarget = null;
      return target;
    },
  };
}
