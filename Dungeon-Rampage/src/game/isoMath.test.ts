import test from 'node:test';
import assert from 'node:assert/strict';
import {
  angleDiff,
  clamp,
  computeComboDamage,
  computeKillScore,
  isoToWorld,
  normalizeVec,
  screenToWorld,
  worldToIso,
} from './isoMath';
import { tryUnlockHero, tryUnlockPet, getDefaultProgress } from './progress';

test('worldToIso and isoToWorld are exact inverses', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 12.5, y: 7.25 },
    { x: 31.8, y: 24.1 },
  ];
  for (const p of points) {
    const iso = worldToIso(p.x, p.y);
    const back = isoToWorld(iso.x, iso.y);
    assert.ok(Math.abs(back.x - p.x) < 1e-9);
    assert.ok(Math.abs(back.y - p.y) < 1e-9);
  }
});

test('screenToWorld maps center pixel directly to camera world point', () => {
  const camWorld = { x: 10, y: 14 };
  const camIso = worldToIso(camWorld.x, camWorld.y);
  const rect = { left: 0, top: 0, width: 1200, height: 800 };
  const mapped = screenToWorld(600, 400, rect, camIso.x, camIso.y);
  assert.ok(Math.abs(mapped.x - camWorld.x) < 1e-9);
  assert.ok(Math.abs(mapped.y - camWorld.y) < 1e-9);
});

test('normalizeVec handles zero vector and unit vectors', () => {
  assert.deepEqual(normalizeVec(0, 0), { x: 0, y: 0 });
  const n = normalizeVec(3, 4);
  assert.ok(Math.abs(n.x - 0.6) < 1e-9);
  assert.ok(Math.abs(n.y - 0.8) < 1e-9);
});

test('angleDiff wraps within [-PI, PI]', () => {
  assert.ok(Math.abs(angleDiff(Math.PI * 1.9, 0.1 * Math.PI) - -0.2 * Math.PI) < 1e-6);
  assert.equal(clamp(15, 0, 10), 10);
});

test('combo damage and kill score scale properly', () => {
  const base = computeComboDamage(20, 0, 0, false);
  const finisher = computeComboDamage(20, 10, 2, true);
  assert.equal(base, 20);
  assert.ok(finisher > base * 2);
  assert.ok(computeKillScore(100, 9, 3) > computeKillScore(100, 0, 1));
});

test('hero and pet unlock logic deducts coins and prevents unaffordable unlocks', () => {
  const base = getDefaultProgress();
  assert.equal(tryUnlockHero(base, 'ranger'), null);
  const rich = { ...base, bankCoins: 200 };
  const afterHero = tryUnlockHero(rich, 'ranger');
  assert.ok(afterHero !== null);
  assert.equal(afterHero.bankCoins, 80);
  assert.ok(afterHero.unlockedHeroes.includes('ranger'));
  assert.equal(afterHero.selectedHero, 'ranger');

  const afterPet = tryUnlockPet({ ...base, bankCoins: 200 }, 'rhino');
  assert.ok(afterPet !== null);
  assert.equal(afterPet.bankCoins, 40);
  assert.ok(afterPet.unlockedPets.includes('rhino'));
});
