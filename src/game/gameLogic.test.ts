import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUCO_SPAWN_RATE_MULTIPLIER,
  computeInitialCucoSpawnDelay,
  computeCucoSpawnInterval,
  computeNextCreakDelay,
  shouldPlayRoomCreak,
  computeNextBoredom,
  shouldSyncBoredomUi,
  FINAL_BOSS_LEVEL,
  shouldShowFirstTimeTutorial,
  shouldWinClassicOnLevelClear,
  isFlashlightHittingCucoBody,
  CUCO_SOUND_TRACKS,
  computeRemainingLevels,
  isHudImminentDanger,
  computeCucoScreechVolume,
  pickNextCucoTrackIndex,
} from './gameLogic';

test('Cuco spawn rate uses gentle 0.85x reduction (interval divided by 0.85)', () => {
  assert.equal(CUCO_SPAWN_RATE_MULTIPLIER, 0.85);

  const classicMin = computeCucoSpawnInterval('classic', 0);
  const classicMax = computeCucoSpawnInterval('classic', 1);
  assert.ok(Math.abs(classicMin - 5.0 / 0.85) < 1e-9);
  assert.ok(Math.abs(classicMax - 10.0 / 0.85) < 1e-9);

  const infiniteMin = computeCucoSpawnInterval('infinite', 0);
  const infiniteMax = computeCucoSpawnInterval('infinite', 1);
  assert.ok(Math.abs(infiniteMin - 4.0 / 0.85) < 1e-9);
  assert.ok(Math.abs(infiniteMax - 8.0 / 0.85) < 1e-9);

  const initialDelay = computeInitialCucoSpawnDelay();
  assert.ok(Math.abs(initialDelay - 3.5 / 0.85) < 1e-9);
});

test('Room creak triggers only when playing and looking at the console', () => {
  assert.equal(
    shouldPlayRoomCreak({ gameState: 'playing', lookingAtConsole: true, isSleeping: false }),
    true
  );
  assert.equal(
    shouldPlayRoomCreak({ gameState: 'playing', lookingAtConsole: false, isSleeping: false }),
    false
  );
  assert.equal(
    shouldPlayRoomCreak({ gameState: 'playing', lookingAtConsole: true, isSleeping: true }),
    false
  );
  assert.equal(
    shouldPlayRoomCreak({ gameState: 'intro', lookingAtConsole: true, isSleeping: false }),
    false
  );
  assert.equal(
    shouldPlayRoomCreak({ gameState: 'jumpscare', lookingAtConsole: true, isSleeping: false }),
    false
  );
});

test('Creak delay stays within subtle random tension range [4.5s, 11.5s]', () => {
  assert.equal(computeNextCreakDelay(0), 4.5);
  assert.equal(computeNextCreakDelay(1), 11.5);
  const mid = computeNextCreakDelay(0.5);
  assert.ok(mid >= 4.5 && mid <= 11.5);
});

test('Boredom drains on console and reaches 100 in 10s looking at room or 14s while feigning sleep', () => {
  assert.equal(computeNextBoredom(50, 1, true, false), 5);
  assert.equal(computeNextBoredom(0, 10, false, false), 100);
  assert.ok(Math.abs(computeNextBoredom(0, 14, false, true) - 100) < 1e-9);
});

test('Boredom UI sync avoids per-frame churn while committing integer/threshold steps', () => {
  assert.equal(shouldSyncBoredomUi(15, 15.16, 16), false);
  assert.equal(shouldSyncBoredomUi(15, 16.0, 60), true);
  assert.equal(shouldSyncBoredomUi(34.9, 35.1, 16), true);
  assert.equal(shouldSyncBoredomUi(64.9, 65.1, 16), true);
  assert.equal(shouldSyncBoredomUi(99.8, 100, 16), true);
  assert.equal(shouldSyncBoredomUi(0.4, 0, 16), true);
});

test('First-time tutorial appears only on initial start and never on retries or subsequent plays', () => {
  assert.equal(shouldShowFirstTimeTutorial(null, false), true);
  assert.equal(shouldShowFirstTimeTutorial('1', false), false);
  assert.equal(shouldShowFirstTimeTutorial(null, true), false);
  assert.equal(shouldShowFirstTimeTutorial('1', true), false);
});

test('Classic mode wins upon clearing Level 15 Final Boss while infinite continues endlessly', () => {
  assert.equal(FINAL_BOSS_LEVEL, 15);
  assert.equal(shouldWinClassicOnLevelClear('classic', 14), false);
  assert.equal(shouldWinClassicOnLevelClear('classic', 15), true);
  assert.equal(shouldWinClassicOnLevelClear('infinite', 15), false);
});

test('Full-body Cuco hitbox detects flashlight aimed at feet, torso, arms, or head', () => {
  const camPos = { x: 0, y: 1.25, z: 0.2 };
  const cucoBase = { x: 0, y: 0, z: -9.2 };
  const normalize = (x: number, y: number, z: number) => {
    const len = Math.hypot(x, y, z);
    return { x: x / len, y: y / len, z: z / len };
  };

  // Aim at head (y = 3.0)
  assert.equal(
    isFlashlightHittingCucoBody(camPos, normalize(0, 3.0 - 1.25, -9.2 - 0.2), cucoBase),
    true
  );
  // Aim at chest/arm offset (x = 0.65, y = 2.0)
  assert.equal(
    isFlashlightHittingCucoBody(camPos, normalize(0.65, 2.0 - 1.25, -9.2 - 0.2), cucoBase),
    true
  );
  // Aim at feet (y = 0.25)
  assert.equal(
    isFlashlightHittingCucoBody(camPos, normalize(0, 0.25 - 1.25, -9.2 - 0.2), cucoBase),
    true
  );
  // Aim well to the left/miss (x = -3.0)
  assert.equal(
    isFlashlightHittingCucoBody(camPos, normalize(-3.0, 1.5 - 1.25, -9.2 - 0.2), cucoBase),
    false
  );
});

test('Remaining levels indicator reflects classic levels left and returns null in infinite mode', () => {
  assert.equal(computeRemainingLevels('classic', 1), 15);
  assert.equal(computeRemainingLevels('classic', 14), 2);
  assert.equal(computeRemainingLevels('classic', 15), 1);
  assert.equal(computeRemainingLevels('infinite', 1), null);
});

test('HUD imminent danger alert activates on high boredom (>65) or spotted Cuco', () => {
  assert.equal(isHudImminentDanger({ boredom: 20, cucoInBeam: false }), false);
  assert.equal(isHudImminentDanger({ boredom: 65, cucoInBeam: false }), false);
  assert.equal(isHudImminentDanger({ boredom: 66, cucoInBeam: false }), true);
  assert.equal(isHudImminentDanger({ boredom: 15, cucoInBeam: true }), true);
});

test('Cuco screech volume varies in [0.62, 0.94] and track picker never repeats last MP3', () => {
  assert.equal(CUCO_SOUND_TRACKS.length, 5);
  assert.ok(Math.abs(computeCucoScreechVolume(0) - 0.62) < 1e-9);
  assert.ok(Math.abs(computeCucoScreechVolume(1) - 0.94) < 1e-9);
  const midVol = computeCucoScreechVolume(0.5);
  assert.ok(midVol > 0.62 && midVol < 0.94);

  for (let last = 0; last < CUCO_SOUND_TRACKS.length; last++) {
    for (const r of [0, 0.25, 0.5, 0.75, 0.99]) {
      const next = pickNextCucoTrackIndex(last, CUCO_SOUND_TRACKS.length, r);
      assert.notEqual(next, last);
      assert.ok(next >= 0 && next < CUCO_SOUND_TRACKS.length);
    }
  }
});

