export const TILE_SIZE = 32;
export const WORLD_COLS = 40;
export const WORLD_ROWS = 28;

export const TILE_GROUND = 0;
export const TILE_WALL = 1;
export const TILE_ENCOUNTER = 2;
export const TILE_PATH = 3;

export function createWorldMap(): number[][] {
  return Array.from({ length: WORLD_ROWS }, (_, y) =>
    Array.from({ length: WORLD_COLS }, (_, x) => {
      if (x === 0 || y === 0 || x === WORLD_COLS - 1 || y === WORLD_ROWS - 1) return TILE_WALL;
      if ((x >= 9 && x <= 13 && y >= 7 && y <= 10) || (x >= 26 && x <= 30 && y >= 16 && y <= 20))
        return TILE_WALL;
      if (y === 13 || y === 14 || x === 19 || x === 20) return TILE_PATH;
      if (
        (x >= 3 && x <= 16 && y >= 3 && y <= 8) ||
        (x >= 22 && x <= 36 && y >= 4 && y <= 11) ||
        (x >= 4 && x <= 17 && y >= 18 && y <= 24) ||
        (x >= 24 && x <= 36 && y >= 21 && y <= 25)
      )
        return TILE_ENCOUNTER;
      return TILE_GROUND;
    })
  );
}
