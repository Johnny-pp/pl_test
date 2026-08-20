import { TILE_ENCOUNTER, TILE_WALL } from "./worldMap.ts";

export interface GridPoint {
  x: number;
  y: number;
}

export type PatrolRandomSource = () => number;

export interface AutoExploreSession {
  active: boolean;
  message?: string;
}

const CARDINAL_DIRECTIONS: readonly GridPoint[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function pointKey(point: GridPoint): string {
  return `${point.x},${point.y}`;
}

function isWalkable(map: readonly (readonly number[])[], point: GridPoint): boolean {
  return (
    point.y >= 0 &&
    point.y < map.length &&
    point.x >= 0 &&
    point.x < (map[point.y]?.length ?? 0) &&
    map[point.y][point.x] !== TILE_WALL
  );
}

/** Finds a reachable encounter tile and returns a path that excludes the starting tile. */
export function createPatrolPath(
  map: readonly (readonly number[])[],
  start: GridPoint,
  random: PatrolRandomSource = Math.random
): GridPoint[] {
  if (!isWalkable(map, start)) return [];

  const queue: GridPoint[] = [start];
  const parents = new Map<string, GridPoint | undefined>([[pointKey(start), undefined]]);
  const reachableTargets: GridPoint[] = [];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (map[current.y]?.[current.x] === TILE_ENCOUNTER) reachableTargets.push(current);
    for (const direction of CARDINAL_DIRECTIONS) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const key = pointKey(next);
      if (!isWalkable(map, next) || parents.has(key)) continue;
      parents.set(key, current);
      queue.push(next);
    }
  }

  const distantTargets = reachableTargets.filter(
    (target) => Math.abs(target.x - start.x) + Math.abs(target.y - start.y) >= 5
  );
  const candidates = distantTargets.length > 0 ? distantTargets : reachableTargets;
  if (candidates.length === 0) return [];
  const roll = Math.max(0, Math.min(0.999999, random()));
  const target = candidates[Math.floor(roll * candidates.length)];
  const path: GridPoint[] = [];
  let current: GridPoint | undefined = target;
  while (current && pointKey(current) !== pointKey(start)) {
    path.push(current);
    current = parents.get(pointKey(current));
  }
  return path.reverse();
}
