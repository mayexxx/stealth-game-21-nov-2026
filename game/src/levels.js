// The three galleries. Each map is 20 rows of 40 tiles, written as four
// 10-character groups per row so a row's width is easy to check by eye.
//   '#' wall    '.' floor   'D' dark floor (slows detection)
//   'C' crate   (cover: blocks movement and sight)
//   'P' player start   'E' exit   'A' relic to steal
// A guard's patrol is a loop of tile waypoints; its first waypoint is where
// it starts. Waypoints sit on floor, and the straight line between two
// consecutive waypoints never crosses a wall or a crate.

export const LEVELS = [
  {
    name: 'The Marble Hall',
    briefing: 'Lift all three relics, then slip out the east door. The guards walk their rounds — learn them before you cross.',
    map: [
      '##########' + '##########' + '##########' + '##########',
      '#.P.......' + '..........' + 'C.........' + 'DDDD..A..#',
      '#.........' + '..........' + '..........' + 'DDDD.....#',
      '#.........' + 'CC........' + '..........' + '.........#',
      '#.........' + '..........' + '........C.' + '.........#',
      '#.........' + '..........' + '........C.' + '.........#',
      '#.........' + '....#####.' + '..........' + '.........#',
      '#.........' + '..........' + '....C.....' + '.........#',
      '#.........' + '..........' + '..........' + '.........#',
      '#.........' + '..........' + '..........' + '...DDDD..#',
      '#.....C...' + '..........' + 'A.........' + '.........#',
      '#.....C...' + '..........' + '..........' + '.........#',
      '#.......##' + '##........' + '....#.....' + '...C.....#',
      '#.........' + '..........' + '....#.....' + '...C.....#',
      '#.........' + '..........' + 'CC..#.....' + '.........#',
      '#..DDD....' + '..........' + '....#.....' + '.........#',
      '#..DDD....' + '.....C....' + '..........' + '.........#',
      '#.........' + '..........' + '..........' + '.........#',
      '#...A.....' + '..........' + '..........' + '.......E.#',
      '##########' + '##########' + '##########' + '##########',
    ],
    patrols: [
      [[12, 2], [26, 2], [26, 5], [12, 5]],
      [[20, 17], [35, 17], [35, 14], [27, 14], [27, 17]],
    ],
  },
  {
    name: 'The Sculpture Court',
    briefing: 'More guards, more shadows. The dark floor hides you — detection grows half as fast there.',
    map: [
      '##########' + '##########' + '##########' + '##########',
      '#.P.......' + '..........' + '..........' + '......A..#',
      '#.......CC' + '..........' + '..........' + '.........#',
      '#.........' + '..........' + '..........' + 'C........#',
      '#.........' + '..........' + '..........' + '.........#',
      '#.........' + '..........' + '....####..' + '.........#',
      '#.........' + '....CC....' + '..........' + '.........#',
      '#.DDD.....' + '..........' + '..........' + '...C.....#',
      '#.DDD.....' + '..........' + '..........' + '...C.....#',
      '#.........' + '.........#' + '#..A......' + '.........#',
      '#.........' + '.........#' + '#.........' + '.........#',
      '#.........' + '..........' + '..........' + '.........#',
      '#.....C...' + '..........' + '.....CC...' + '.........#',
      '#.........' + '..#.......' + '..........' + '....DDD..#',
      '#.........' + '..#.......' + '..........' + '....DDD..#',
      '#.........' + '..#.C.....' + '..........' + '.........#',
      '#.........' + '..#.......' + '..........' + '.C.......#',
      '#.......DD' + 'D.......C.' + '..........' + '.C.......#',
      '#...A.....' + '..........' + '..........' + '.......E.#',
      '##########' + '##########' + '##########' + '##########',
    ],
    patrols: [
      [[6, 3], [18, 3], [18, 4], [6, 4]],
      [[24, 8], [31, 8], [31, 10], [24, 10]],
      [[20, 16], [30, 16], [30, 18], [20, 18]],
    ],
  },
  {
    name: 'The Vault Wing',
    briefing: 'Four guards and the tightest rounds in the house. Walk, do not run — and keep a pebble for the far corridor.',
    map: [
      '##########' + '##########' + '##########' + '##########',
      '#.P.......' + '..........' + '..........' + '......A..#',
      '#.........' + '...#....C.' + '..........' + '.........#',
      '#.........' + '...#....C.' + '..........' + '.........#',
      '#.........' + '...#......' + '..........' + '.....C...#',
      '#.........' + '...#......' + '####......' + '.........#',
      '#.........' + '...#......' + '..........' + '.........#',
      '#.........' + '...#......' + '.......C..' + '...DDD...#',
      '#.........' + '..........' + '..........' + '...DDD...#',
      '#.........' + 'C.........' + 'A.........' + '.........#',
      '#..DDD....' + 'C.........' + '......####' + '##.......#',
      '#..DDD....' + '..........' + '..........' + '......C..#',
      '#.........' + '..........' + '..........' + '#........#',
      '#.....##..' + '..........' + '..........' + '#........#',
      '#.....##..' + '..........' + '..........' + '#........#',
      '#.........' + '......C...' + '..........' + '#........#',
      '#....C....' + '..........' + '....DDD...' + '#........#',
      '#.........' + '..........' + '..CCDDD...' + '.........#',
      '#...A.....' + '..........' + '..........' + '.......E.#',
      '##########' + '##########' + '##########' + '##########',
    ],
    patrols: [
      [[5, 2], [11, 2], [11, 7], [5, 7]],
      [[16, 4], [19, 4], [19, 8], [16, 8]],
      [[32, 12], [37, 12], [37, 16], [32, 16]],
      [[6, 15], [12, 15], [12, 18], [6, 18]],
    ],
  },
];

/**
 * Parse one level's map into tiles and points of interest. Tiles are
 * 'wall' | 'crate' | 'dark' | 'floor'. Returns the player start, the exit,
 * the relic tiles and a lookup for what stands on a tile.
 */
export function parseLevel(def) {
  const tiles = [];
  let player = null;
  let exit = null;
  const relics = [];
  for (let row = 0; row < def.map.length; row += 1) {
    const line = def.map[row];
    const out = [];
    for (let col = 0; col < line.length; col += 1) {
      const ch = line[col];
      if (ch === '#') out.push('wall');
      else if (ch === 'C') out.push('crate');
      else if (ch === 'D') out.push('dark');
      else out.push('floor');
      if (ch === 'P') player = { col, row };
      else if (ch === 'E') exit = { col, row };
      else if (ch === 'A') relics.push({ col, row, taken: false });
    }
    tiles.push(out);
  }
  return { tiles, player, exit, relics };
}

/** Tile kind at a tile coordinate, 'wall' outside the map. */
export function tileAt(tiles, col, row) {
  if (row < 0 || row >= tiles.length || col < 0 || col >= tiles[0].length) return 'wall';
  return tiles[row][col];
}

/** True when the tile blocks movement and sight. */
export function blocksTile(tiles, col, row) {
  const kind = tileAt(tiles, col, row);
  return kind === 'wall' || kind === 'crate';
}

/** Tile coordinates of a pixel position. */
export function tileOf(x, y) {
  return { col: Math.floor(x / 32), row: Math.floor((y - 80) / 32) };
}

/** Pixel centre of a tile. */
export function tileCentre(col, row) {
  return { x: col * 32 + 16, y: 80 + row * 32 + 16 };
}
