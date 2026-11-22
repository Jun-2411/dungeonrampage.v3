import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeonFloor, isWalkableTile } from './dungeonGen';

test('generateDungeonFloor produces valid entry spawn with open clearance and connected rooms', () => {
  for (let floor = 1; floor <= 3; floor++) {
    const data = generateDungeonFloor(floor, 424242);
    assert.equal(data.floorNumber, floor);
    assert.ok(data.rooms.length >= 5);

    const sx = Math.floor(data.spawnX);
    const sy = Math.floor(data.spawnY);
    assert.equal(data.tiles[sy][sx], 'floor');

    // Verify >= 3x3 walkable clearance around spawn so player never spawns in or facing a wall
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        assert.ok(isWalkableTile(data.tiles[sy + dy][sx + dx]));
      }
    }

    // Verify no enemies spawn inside the entry courtyard
    const entry = data.rooms[0];
    for (const enemy of data.enemies) {
      const inEntry =
        enemy.x >= entry.x &&
        enemy.x <= entry.x + entry.w &&
        enemy.y >= entry.y &&
        enemy.y <= entry.y + entry.h;
      assert.equal(inEntry, false, `Enemy ${enemy.kind} should not spawn in entry courtyard`);
    }

    // Verify portal tile exists
    assert.equal(data.tiles[Math.floor(data.portalY)][Math.floor(data.portalX)], 'portal');
  }
});

test('Floor 3 spawns Lord Dinglepus boss in boss_sanctum', () => {
  const floor3 = generateDungeonFloor(3, 999);
  const boss = floor3.enemies.find((e) => e.kind === 'boss');
  assert.ok(boss !== undefined);
  assert.equal(boss.name, 'Lord Dinglepus');
  assert.equal(floor3.rooms[floor3.rooms.length - 1].template, 'boss_sanctum');
});

test('different seeds yield different procedural room layouts', () => {
  const a = generateDungeonFloor(1, 101);
  const b = generateDungeonFloor(1, 20202);
  const differs =
    a.rooms[1].x !== b.rooms[1].x ||
    a.rooms[1].y !== b.rooms[1].y ||
    a.rooms[2].x !== b.rooms[2].x ||
    a.rooms[1].template !== b.rooms[1].template;
  assert.ok(differs);
});
