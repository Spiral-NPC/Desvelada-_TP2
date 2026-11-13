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
