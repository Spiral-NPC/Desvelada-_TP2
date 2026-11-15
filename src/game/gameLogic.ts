import { GameMode, GameState } from '../types';

export const CUCO_SPAWN_RATE_MULTIPLIER = 0.85; // Gentle reduction (~15% lower than original rate, ~10.5% lower than 0.95x)
export const BASE_INITIAL_CUCO_DELAY_SEC = 3.5;

/**
 * Initial countdown (seconds) before the first Cuco spawns.
 */
export function computeInitialCucoSpawnDelay(): number {
  return BASE_INITIAL_CUCO_DELAY_SEC / CUCO_SPAWN_RATE_MULTIPLIER;
}

/**
 * Computes the next Cuco spawn countdown interval (seconds).
 * Reducing the spawn rate increases the interval between spawns by 1 / CUCO_SPAWN_RATE_MULTIPLIER.
 */
export function computeCucoSpawnInterval(mode: GameMode, rand: number = Math.random()): number {
  const clampedRand = Math.max(0, Math.min(1, rand));
  const baseInterval =
    mode === 'infinite'
      ? 4.0 + clampedRand * 4.0 // 4s - 8s base -> ~4.71s - 9.41s
      : 5.0 + clampedRand * 5.0; // 5s - 10s base -> ~5.88s - 11.76s

  return baseInterval / CUCO_SPAWN_RATE_MULTIPLIER;
}

/**
 * Random interval (seconds) between subtle ambient room creaking sounds while playing the console.
 */
export function computeNextCreakDelay(rand: number = Math.random()): number {
  const clampedRand = Math.max(0, Math.min(1, rand));
  return 4.5 + clampedRand * 7.0; // 4.5s to 11.5s
}

/**
 * Creaking sounds only trigger when the player is actively looking at the console during gameplay
 * (and not feigning sleep), building tension about what might be moving behind them.
 */
export function shouldPlayRoomCreak(params: {
  gameState: GameState;
  lookingAtConsole: boolean;
  isSleeping: boolean;
}): boolean {
  return params.gameState === 'playing' && params.lookingAtConsole && !params.isSleeping;
}

/**
 * Pure sleep/boredom meter step calculation.
 */
export function computeNextBoredom(
  current: number,
  dt: number,
  lookingAtConsole: boolean,
  isSleeping: boolean
): number {
  if (isSleeping) {
    return Math.min(100, current + (100 / 14.0) * dt);
  }
  if (lookingAtConsole) {
    return Math.max(0, current - 45.0 * dt);
  }
  return Math.min(100, current + (100 / 10.0) * dt);
}

const BOREDOM_THRESHOLDS = [35, 60, 65] as const;

/**
 * Determines whether React HUD state should commit a boredom update,
 * preventing 60Hz full-tree re-renders while preserving smooth progress & threshold transitions.
 */
export function shouldSyncBoredomUi(
  prevCommitted: number,
  nextValue: number,
  elapsedSinceCommitMs: number
): boolean {
  if (nextValue >= 100 && prevCommitted < 100) return true;
  if (nextValue <= 0 && prevCommitted > 0) return true;
  for (const t of BOREDOM_THRESHOLDS) {
    if ((prevCommitted <= t && nextValue > t) || (prevCommitted > t && nextValue <= t)) {
      return true;
    }
  }
  if (Math.round(prevCommitted) !== Math.round(nextValue) && elapsedSinceCommitMs >= 50) {
    return true;
  }
  return elapsedSinceCommitMs >= 100 && Math.abs(nextValue - prevCommitted) >= 0.4;
}

export const TUTORIAL_STORAGE_KEY = 'desvelada_tutorial_seen';
export const FINAL_BOSS_LEVEL = 15;

/**
 * Shows the quick interactive tutorial ONLY on the player's first game after pressing JUGAR,
 * never on retries or subsequent sessions once seen.
 */
export function shouldShowFirstTimeTutorial(
  storedFlag: string | null | undefined,
  isRetry: boolean
): boolean {
  return !isRetry && storedFlag !== '1';
}

/**
 * Classic mode is won upon clearing Level 15 (the crowned Final Boss), replacing the 6:00 AM timer.
 */
export function shouldWinClassicOnLevelClear(mode: GameMode, clearedLevel: number): boolean {
  return mode === 'classic' && clearedLevel >= FINAL_BOSS_LEVEL;
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Full-body capsule/ray intersection check for the 1.5x-scaled Cuco monster.
 * Spine spans from feet (base.y + 0.25) to top of diamond head (base.y + 3.25)
 * with generous body radius covering torso, claws, and head.
 */
export function isFlashlightHittingCucoBody(
  rayOrigin: Vec3Like,
  rayDir: Vec3Like,
  cucoBasePos: Vec3Like,
  bodyRadius: number = 0.92
): boolean {
  const segAx = cucoBasePos.x;
  const segAy = cucoBasePos.y + 0.25;
  const segAz = cucoBasePos.z;
  const segBx = cucoBasePos.x;
  const segBy = cucoBasePos.y + 3.25;
  const segBz = cucoBasePos.z;

  // Compute closest points between ray (rayOrigin + t * rayDir, t >= 0) and vertical segment A->B
  const ux = rayDir.x;
  const uy = rayDir.y;
  const uz = rayDir.z;
  const vx = segBx - segAx;
  const vy = segBy - segAy;
  const vz = segBz - segAz;
  const wx = rayOrigin.x - segAx;
  const wy = rayOrigin.y - segAy;
  const wz = rayOrigin.z - segAz;

  const a = ux * ux + uy * uy + uz * uz;
  const b = ux * vx + uy * vy + uz * vz;
  const c = vx * vx + vy * vy + vz * vz;
  const d = ux * wx + uy * wy + uz * wz;
  const e = vx * wx + vy * wy + vz * wz;
  const denom = a * c - b * b;

  let sc: number;
  let tc: number;

  if (denom < 1e-6) {
    // Ray nearly parallel to vertical body spine
    sc = 0;
    tc = b > c ? d / b : e / c;
  } else {
    sc = (b * e - c * d) / denom;
    tc = (a * e - b * d) / denom;
  }

  // Clamp ray parameter to forward direction (in front of player camera)
  if (sc < 0) {
    sc = 0;
    tc = e / c;
  }

  // Clamp segment parameter tc to [0, 1] and recompute closest ray point if clamped
  if (tc < 0) {
    tc = 0;
    sc = Math.max(0, -d / a);
  } else if (tc > 1) {
    tc = 1;
    sc = Math.max(0, (-d + b) / a);
  }

  const dx = wx + sc * ux - tc * vx;
  const dy = wy + sc * uy - tc * vy;
  const dz = wz + sc * uz - tc * vz;
  const distSq = dx * dx + dy * dy + dz * dz;

  return distSq <= bodyRadius * bodyRadius;
}

export const CUCO_SOUND_TRACKS = [
  '/assets/aistudio/Cuco_mixdown_Track_1_1e77a751.mp3',
  '/assets/aistudio/Cuco_mixdown_Track_2_d0e5eb21.mp3',
  '/assets/aistudio/Cuco_mixdown_Track_3_fe45badf.mp3',
  '/assets/aistudio/Cuco_mixdown_Track_4_7999f724.mp3',
  '/assets/aistudio/Cuco_mixdown_Track_5_7325e681.mp3',
] as const;

/**
 * Computes how many minigame levels remain in Classic mode (levels 1..15 inclusive).
 * Returns null in Infinite mode because there is no final level cap.
 */
export function computeRemainingLevels(mode: GameMode, currentLevel: number): number | null {
  if (mode !== 'classic') return null;
  if (currentLevel > FINAL_BOSS_LEVEL) return 0;
  return Math.max(1, FINAL_BOSS_LEVEL - Math.max(1, currentLevel) + 1);
}

/**
 * Determines whether the player is in imminent danger so the HUD boredom meter
 * triggers its constant #f4b637 alert pulse animation.
 */
export function isHudImminentDanger(params: {
  boredom: number;
  cucoInBeam: boolean;
}): boolean {
  return params.boredom > 65 || params.cucoInBeam;
}

/**
 * Randomizes the Cuco screech volume within a tight natural range [0.62, 0.94]
 * so consecutive flashlight illuminations never sound identical.
 */
export function computeCucoScreechVolume(rand: number = Math.random()): number {
  const clamped = Math.max(0, Math.min(1, rand));
  return 0.62 + clamped * 0.32;
}

/**
 * Picks a Cuco MP3 track index without repeating the immediately preceding track.
 */
export function pickNextCucoTrackIndex(
  lastIndex: number,
  trackCount: number = CUCO_SOUND_TRACKS.length,
  rand: number = Math.random()
): number {
  if (trackCount <= 1) return 0;
  const clamped = Math.max(0, Math.min(0.999999, rand));
  if (lastIndex < 0 || lastIndex >= trackCount) {
    return Math.floor(clamped * trackCount);
  }
  const candidate = Math.floor(clamped * (trackCount - 1));
  return candidate >= lastIndex ? candidate + 1 : candidate;
}

