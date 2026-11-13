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
