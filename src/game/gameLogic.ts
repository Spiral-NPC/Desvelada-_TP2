import { GameMode, GameState } from '../types';

export const CUCO_SPAWN_RATE_MULTIPLIER = 0.68; // Reduced base rate (~20% slower than 0.85x) so Cucos appear less often
export const BASE_INITIAL_CUCO_DELAY_SEC = 4.8; // ~7.06s initial delay before first Cuco spawns
export const POST_TUTORIAL_MIN_SAFE_SEC = 1.8; // Minimum >1s grace window after tutorial before Cuco can appear
export const CUCO_DANGER_HEARTBEAT_THRESHOLD_SEC = 2.6; // Remaining attack seconds when accelerating heartbeat begins

/**
 * Initial countdown (seconds) before the first Cuco spawns.
 */
export function computeInitialCucoSpawnDelay(): number {
  return BASE_INITIAL_CUCO_DELAY_SEC / CUCO_SPAWN_RATE_MULTIPLIER;
}

/**
 * Guarantees a minimum safe grace period (>= 1s) right after finishing the tutorial
 * so the player can absorb instructions and start advancing in the minigame.
 */
export function computePostTutorialCucoDelay(currentCountdown: number): number {
  return Math.max(currentCountdown, POST_TUTORIAL_MIN_SAFE_SEC);
}

/**
 * Computes the next Cuco spawn countdown interval (seconds).
 * Keeps a steady, balanced spawn cadence without accelerating across minigame levels.
 */
export function computeCucoSpawnInterval(
  mode: GameMode,
  rand: number = Math.random()
): number {
  const clampedRand = Math.max(0, Math.min(1, rand));
  const baseInterval =
    mode === 'infinite'
      ? 4.0 + clampedRand * 4.0
      : 5.0 + clampedRand * 5.0;

  return baseInterval / CUCO_SPAWN_RATE_MULTIPLIER;
}

export interface DangerHeartbeatState {
  active: boolean;
  urgency: number;
  intervalSec: number;
}

/**
 * Determines whether the Cuco is about to catch the player and calculates
 * accelerating heartbeat urgency [0..1] and interval [0.62s..0.26s].
 * Immediately stops when the player loses, sleeps, wins, or is in the tutorial.
 */
export function computeCucoDangerHeartbeatState(params: {
  gameState: GameState;
  isSleeping: boolean;
  tutorialActive: boolean;
  monsters: ReadonlyArray<{ timer: number; isAttacking: boolean }>;
}): DangerHeartbeatState {
  if (
    params.gameState !== 'playing' ||
    params.isSleeping ||
    params.tutorialActive ||
    params.monsters.length === 0
  ) {
    return { active: false, urgency: 0, intervalSec: 0 };
  }

  let minTimer = Infinity;
  for (const m of params.monsters) {
    if (!m.isAttacking && m.timer > 0 && m.timer < minTimer) {
      minTimer = m.timer;
    }
  }

  if (!Number.isFinite(minTimer) || minTimer > CUCO_DANGER_HEARTBEAT_THRESHOLD_SEC) {
    return { active: false, urgency: 0, intervalSec: 0 };
  }

  const urgency = Math.max(
    0,
    Math.min(1, 1 - minTimer / CUCO_DANGER_HEARTBEAT_THRESHOLD_SEC)
  );
  const intervalSec = 0.62 - urgency * 0.36; // Accelerates smoothly from ~97 BPM to ~230 BPM
  return { active: true, urgency, intervalSec };
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

export const TUTORIAL_STORAGE_KEY = 'desvelada_tutorial_v2_seen';
export const FINAL_BOSS_LEVEL = 15;

/**
 * Plays the interactive tutorial every time a new game starts (both initial start and replays).
 * Optional parameters remain accepted for signature compatibility.
 */
export function shouldShowFirstTimeTutorial(
  _storedFlag?: string | null,
  _isRetry?: boolean
): boolean {
  return true;
}

export interface FoxyJumpscarePose {
  leapT: number;
  arcY: number;
  bodyPitchX: number;
  headRollZ: number;
  headYawY: number;
  headPitchX: number;
  jawRotX: number;
  leftArmRotX: number;
  leftArmRotZ: number;
  rightArmRotX: number;
  rightArmRotZ: number;
  eyeLightIntensity: number;
}

/**
 * Pure kinematics approximating the FNAF 2 Foxy jumpscare lunge:
 * - Phase 1 (0..0.38): Explosive aerial arc leap toward the player's face with arms thrown wide & jaw snapping open.
 * - Phase 2 (0.38..1.0): Face-to-face mid-air thrashing, violent head roll/snap, wide-chomping lower jaw, and clawing arms.
 */
export function computeFoxyJumpscarePose(progress: number): FoxyJumpscarePose {
  const p = Math.max(0, Math.min(1, progress));
  const leapPhase = Math.min(1, p / 0.28);
  const leapT = 1 - Math.pow(1 - leapPhase, 3); // fast easeOutCubic surge

  // Parabolic leap arc upward before locking in front of the player's face
  const arcPhase = Math.min(1, p / 0.34);
  const arcY = Math.sin(arcPhase * Math.PI) * 0.48;

  // Body leans forward horizontally into the aerial dive
  const bodyPitchX = 0.50 * leapT;

  // Violent Foxy-style head convulsion & side-to-side whipping once in range
  const thrashWeight = p > 0.20 ? Math.min(1, (p - 0.20) / 0.15) : 0;
  const headRollZ = Math.sin(p * 46) * 0.24 * thrashWeight;
  const headYawY = Math.cos(p * 38) * 0.18 * thrashWeight;
  const headPitchX = -0.18 * leapT + Math.sin(p * 52) * 0.1 * thrashWeight;

  // Wide hinged lower jaw snapping open and chomping rapidly
  const jawBase = 0.84 * leapT;
  const jawChomp = Math.sin(p * 40) * 0.24 * thrashWeight;
  const jawRotX = Math.max(0, jawBase + jawChomp);

  // Arms flung wide outward & forward like Foxy's clawing lunge
  const leftArmRotX = -1.65 * leapT + Math.sin(p * 34) * 0.18 * thrashWeight;
  const leftArmRotZ = -0.92 * leapT - Math.sin(p * 28) * 0.14 * thrashWeight;
  const rightArmRotX = -1.52 * leapT - Math.sin(p * 34) * 0.18 * thrashWeight;
  const rightArmRotZ = 0.88 * leapT + Math.cos(p * 28) * 0.14 * thrashWeight;

  // Dramatic horror strobe lighting on face & gaping teeth
  const strobe = 0.7 + 0.3 * Math.sin(p * 55);
  const eyeLightIntensity = 9.0 + 10.0 * leapT * strobe;

  return {
    leapT,
    arcY,
    bodyPitchX,
    headRollZ,
    headYawY,
    headPitchX,
    jawRotX,
    leftArmRotX,
    leftArmRotZ,
    rightArmRotX,
    rightArmRotZ,
    eyeLightIntensity,
  };
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

