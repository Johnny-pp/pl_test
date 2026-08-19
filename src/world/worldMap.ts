export const TILE_SIZE = 32;
export const WORLD_COLS = 40;
export const WORLD_ROWS = 28;

export const TILE_GROUND = 0;
export const TILE_WALL = 1;
export const TILE_ENCOUNTER = 2;
export const TILE_PATH = 3;

function createFrontierTile(x: number, y: number): number {
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
}

function createHighlandTile(x: number, y: number): number {
  if (
    (x >= 7 && x <= 11 && y >= 5 && y <= 19) ||
    (x >= 27 && x <= 33 && y >= 7 && y <= 11) ||
    (x >= 24 && x <= 28 && y >= 18 && y <= 23)
  )
    return TILE_WALL;
  if (y === 13 || y === 14 || (x >= 18 && x <= 21)) return TILE_PATH;
  if (
    (x >= 2 && x <= 17 && y >= 3 && y <= 10) ||
    (x >= 12 && x <= 18 && y >= 17 && y <= 25) ||
    (x >= 22 && x <= 37 && y >= 3 && y <= 6) ||
    (x >= 29 && x <= 37 && y >= 15 && y <= 25)
  )
    return TILE_ENCOUNTER;
  return TILE_GROUND;
}

export function createWorldMap(region: WorldRegion = "frontier"): number[][] {
  return Array.from({ length: WORLD_ROWS }, (_, y) =>
    Array.from({ length: WORLD_COLS }, (_, x) => {
      if (x === 0 || y === 0 || x === WORLD_COLS - 1 || y === WORLD_ROWS - 1) return TILE_WALL;
      return region === HIGHLAND_REGION ? createHighlandTile(x, y) : createFrontierTile(x, y);
    })
  );
}
import { HIGHLAND_REGION, type WorldRegion } from "./regions.ts";
