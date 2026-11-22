import { TILE_HALF_H, TILE_HALF_W } from './constants';

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Projects 2D dungeon world coordinates (wx, wy) in tile units
 * into 2:1 isometric screen coordinates relative to camera origin.
 */
export function worldToIso(wx: number, wy: number): Vec2 {
  return {
    x: (wx - wy) * TILE_HALF_W,
    y: (wx + wy) * TILE_HALF_H,
  };
}

/**
 * Inverse projects 2:1 isometric canvas-space coordinates (relative to world origin)
 * back into dungeon world tile coordinates (wx, wy).
 */
export function isoToWorld(ix: number, iy: number): Vec2 {
  const a = ix / TILE_HALF_W;
  const b = iy / TILE_HALF_H;
  return {
    x: (a + b) * 0.5,
    y: (b - a) * 0.5,
  };
}

/**
 * Converts client pointer coordinates into world coordinates using live canvas bounds.
 */
export function screenToWorld(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  cameraIsoX: number,
  cameraIsoY: number
): Vec2 {
  const sx = clientX - rect.left - rect.width * 0.5 + cameraIsoX;
  const sy = clientY - rect.top - rect.height * 0.5 + cameraIsoY;
  return isoToWorld(sx, sy);
}

export function normalizeVec(dx: number, dy: number): Vec2 {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

export function clamp(val: number, min: number, max: number): number {
  return val < min ? min : val > max ? max : val;
}

export function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function computeComboDamage(
  baseDamage: number,
  comboCount: number,
  comboStep: number,
  isWallSlam = false
): number {
  const finisherMult = comboStep === 2 ? 1.45 : comboStep === 1 ? 1.15 : 1.0;
  const streakMult = 1 + Math.min(comboCount, 20) * 0.025;
  const slamBonus = isWallSlam ? 14 : 0;
  return Math.round(baseDamage * finisherMult * streakMult + slamBonus);
}

export function computeKillScore(basePoints: number, comboCount: number, floor: number): number {
  const multiplier = 1 + Math.min(Math.floor(comboCount / 3), 5) * 0.25;
  return Math.round(basePoints * multiplier * (1 + (floor - 1) * 0.35));
}
