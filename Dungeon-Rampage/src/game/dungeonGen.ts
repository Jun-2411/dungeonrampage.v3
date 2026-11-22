import { FLOOR_PALETTES, MAX_FLOORS } from './constants';
import type {
  DestructibleProp,
  DungeonFloorData,
  EnemyEntity,
  EnemyKind,
  PropKind,
  RoomRect,
  RoomTemplateKind,
  TileKind,
  TorchLight,
} from './types';

const GRID_W = 46;
const GRID_H = 46;

export interface Rng {
  next: () => number;
}

export function createSeededRng(seed: number): Rng {
  let s = (seed >>> 0) || 123456789;
  return {
    next: () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    },
  };
}

function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng.next() * (max - min + 1)) + min;
}

function pickOne<T>(rng: Rng, arr: T[]): T {
  return arr[Math.floor(rng.next() * arr.length)];
}

export function isWalkableTile(tile: TileKind): boolean {
  return tile === 'floor' || tile === 'spikes' || tile === 'portal';
}

function carveRoomTemplate(
  tiles: TileKind[][],
  room: RoomRect,
  rng: Rng
): { props: Array<{ kind: PropKind; x: number; y: number }>; torches: Array<{ x: number; y: number }> } {
  const props: Array<{ kind: PropKind; x: number; y: number }> = [];
  const torches: Array<{ x: number; y: number }> = [];

  for (let ty = room.y; ty < room.y + room.h; ty++) {
    for (let tx = room.x; tx < room.x + room.w; tx++) {
      tiles[ty][tx] = 'floor';
    }
  }

  // Corner torches
  torches.push(
    { x: room.x + 0.6, y: room.y + 0.6 },
    { x: room.x + room.w - 0.6, y: room.y + 0.6 },
    { x: room.x + 0.6, y: room.y + room.h - 0.6 },
    { x: room.x + room.w - 0.6, y: room.y + room.h - 0.6 }
  );

  const cx = Math.floor(room.cx);
  const cy = Math.floor(room.cy);

  switch (room.template) {
    case 'entry_courtyard': {
      // Safe open starting dais; 2 breakable urns near corners away from spawn center
      props.push(
        { kind: 'urn', x: room.x + 1.5, y: room.y + 1.5 },
        { kind: 'crate', x: room.x + room.w - 1.5, y: room.y + 1.5 }
      );
      break;
    }
    case 'pillar_arena': {
      // Open grand clash arena without obstructive center pillars
      props.push(
        { kind: 'barrel', x: room.x + 1.2, y: room.y + 1.2 },
        { kind: 'crate', x: room.x + room.w - 1.2, y: room.y + room.h - 1.2 }
      );
      if (rng.next() < 0.75) {
        props.push({ kind: 'urn', x: room.x + 1.2, y: room.y + room.h - 1.2 });
      }
      break;
    }
    case 'cross_bridge': {
      // Clear wide combat floor
      props.push(
        { kind: 'crate', x: room.x + 1.2, y: room.y + 1.2 },
        { kind: 'barrel', x: room.x + room.w - 1.2, y: room.y + 1.2 }
      );
      break;
    }
    case 'vault_treasury': {
      // Guarded treasure chest at center + breakables along perimeter
      props.push(
        { kind: 'chest', x: cx + 0.5, y: cy + 0.5 },
        { kind: 'barrel', x: room.x + 1.2, y: room.y + 1.2 },
        { kind: 'crate', x: room.x + room.w - 1.2, y: room.y + 1.2 },
        { kind: 'urn', x: room.x + 1.2, y: room.y + room.h - 1.2 }
      );
      break;
    }
    case 'ossuary_hall': {
      // Broad open slaughter hall
      props.push(
        { kind: 'urn', x: room.x + 1.2, y: cy + 0.5 },
        { kind: 'barrel', x: room.x + room.w - 1.2, y: cy + 0.5 },
        { kind: 'crate', x: cx + 0.5, y: room.y + 1.2 }
      );
      break;
    }
    case 'boss_sanctum': {
      // Colossal open sanctum with perimeter loot and zero center obstacles
      props.push(
        { kind: 'urn', x: room.x + 1.2, y: room.y + 1.2 },
        { kind: 'barrel', x: room.x + room.w - 1.2, y: room.y + 1.2 },
        { kind: 'crate', x: room.x + 1.2, y: room.y + room.h - 1.2 },
        { kind: 'chest', x: room.x + room.w - 1.2, y: room.y + room.h - 1.2 }
      );
      break;
    }
  }

  return { props, torches };
}

function carveCorridor(tiles: TileKind[][], x1: number, y1: number, x2: number, y2: number, rng: Rng): void {
  let x = x1;
  let y = y1;
  const horizontalFirst = rng.next() < 0.5;

  const paintBrush = (cx: number, cy: number) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx > 1 && nx < GRID_W - 2 && ny > 1 && ny < GRID_H - 2) {
          if (tiles[ny][nx] === 'void') {
            tiles[ny][nx] = 'floor';
          }
        }
      }
    }
  };

  if (horizontalFirst) {
    while (x !== x2) {
      paintBrush(x, y);
      x += x < x2 ? 1 : -1;
    }
    while (y !== y2) {
      paintBrush(x, y);
      y += y < y2 ? 1 : -1;
    }
  } else {
    while (y !== y2) {
      paintBrush(x, y);
      y += y < y2 ? 1 : -1;
    }
    while (x !== x2) {
      paintBrush(x, y);
      x += x < x2 ? 1 : -1;
    }
  }
  paintBrush(x2, y2);
}

function makeEnemy(
  id: number,
  kind: EnemyKind,
  x: number,
  y: number,
  floor: number,
  roomId: number,
  rng: Rng
): EnemyEntity {
  const scale = 1 + (floor - 1) * 0.32;
  const isElite = kind !== 'boss' && rng.next() < 0.18;
  const eliteHpMult = isElite ? 2.2 : 1.0;
  const eliteDmgMult = isElite ? 1.35 : 1.0;

  switch (kind) {
    case 'skeleton': {
      const hp = Math.round(62 * scale * eliteHpMult);
      return {
        id,
        kind,
        name: isElite ? 'Champion Marauder' : 'Bone Marauder',
        x,
        y,
        vx: 0,
        vy: 0,
        facing: rng.next() * Math.PI * 2,
        hp,
        maxHp: hp,
        radius: isElite ? 0.42 : 0.34,
        speed: (2.75 + (floor - 1) * 0.18) * (isElite ? 1.12 : 1.0),
        damage: Math.round(16 * scale * eliteDmgMult),
        state: 'chase',
        stateTimer: 0,
        windupDuration: isElite ? 0.32 : 0.36,
        attackCooldown: 0.45 + rng.next() * 0.35,
        hitFlash: 0,
        squashX: 1,
        squashY: 1,
        gaitDist: rng.next() * 4,
        deathTimer: 0,
        hasToken: false,
        aimAngle: 0,
        targetX: x,
        targetY: y,
        phase: 0,
        roomId,
        isElite,
      };
    }
    case 'goblin': {
      const hp = Math.round(48 * scale * eliteHpMult);
      return {
        id,
        kind,
        name: isElite ? 'Elite Sniper' : 'Goblin Arbalest',
        x,
        y,
        vx: 0,
        vy: 0,
        facing: rng.next() * Math.PI * 2,
        hp,
        maxHp: hp,
        radius: isElite ? 0.38 : 0.31,
        speed: (2.95 + (floor - 1) * 0.16) * (isElite ? 1.15 : 1.0),
        damage: Math.round(18 * scale * eliteDmgMult),
        state: 'kite',
        stateTimer: 0,
        windupDuration: isElite ? 0.45 : 0.52,
        attackCooldown: 0.7 + rng.next() * 0.5,
        hitFlash: 0,
        squashX: 1,
        squashY: 1,
        gaitDist: rng.next() * 4,
        deathTimer: 0,
        hasToken: false,
        aimAngle: 0,
        targetX: x,
        targetY: y,
        phase: 0,
        roomId,
        isElite,
      };
    }
    case 'orc': {
      const hp = Math.round(135 * scale * eliteHpMult);
      return {
        id,
        kind,
        name: isElite ? 'Warlord Crusher' : 'Orc Crusher',
        x,
        y,
        vx: 0,
        vy: 0,
        facing: rng.next() * Math.PI * 2,
        hp,
        maxHp: hp,
        radius: isElite ? 0.52 : 0.43,
        speed: (2.2 + (floor - 1) * 0.14) * (isElite ? 1.15 : 1.0),
        damage: Math.round(28 * scale * eliteDmgMult),
        state: 'chase',
        stateTimer: 0,
        windupDuration: isElite ? 0.52 : 0.6,
        attackCooldown: 0.85 + rng.next() * 0.4,
        hitFlash: 0,
        squashX: 1,
        squashY: 1,
        gaitDist: rng.next() * 4,
        deathTimer: 0,
        hasToken: false,
        aimAngle: 0,
        targetX: x,
        targetY: y,
        phase: 0,
        roomId,
        isElite,
      };
    }
    case 'cultist': {
      const hp = Math.round(78 * scale * eliteHpMult);
      return {
        id,
        kind,
        name: isElite ? 'Arch-Pyromancer' : 'Dinglepus Pyromancer',
        x,
        y,
        vx: 0,
        vy: 0,
        facing: rng.next() * Math.PI * 2,
        hp,
        maxHp: hp,
        radius: isElite ? 0.42 : 0.34,
        speed: (2.35 + (floor - 1) * 0.12) * (isElite ? 1.1 : 1.0),
        damage: Math.round(25 * scale * eliteDmgMult),
        state: 'kite',
        stateTimer: 0,
        windupDuration: isElite ? 0.58 : 0.68,
        attackCooldown: 1.1 + rng.next() * 0.5,
        hitFlash: 0,
        squashX: 1,
        squashY: 1,
        gaitDist: rng.next() * 4,
        deathTimer: 0,
        hasToken: false,
        aimAngle: 0,
        targetX: x,
        targetY: y,
        phase: 0,
        roomId,
        isElite,
      };
    }
    case 'boss':
      return {
        id,
        kind: 'boss',
        name: 'Lord Dinglepus',
        x,
        y,
        vx: 0,
        vy: 0,
        facing: Math.PI * 0.75,
        hp: 980,
        maxHp: 980,
        radius: 0.62,
        speed: 2.65,
        damage: 32,
        state: 'chase',
        stateTimer: 0,
        windupDuration: 0.62,
        attackCooldown: 0.95,
        hitFlash: 0,
        squashX: 1,
        squashY: 1,
        gaitDist: 0,
        deathTimer: 0,
        hasToken: true,
        aimAngle: 0,
        targetX: x,
        targetY: y,
        phase: 1,
        roomId,
        isElite: true,
      };
  }
}

export function generateDungeonFloor(floorNumber: number, seed: number): DungeonFloorData {
  const rng = createSeededRng(seed + floorNumber * 7919);
  const palette = FLOOR_PALETTES[floorNumber] ?? FLOOR_PALETTES[1];

  const tiles: TileKind[][] = Array.from({ length: GRID_H }, () =>
    Array.from({ length: GRID_W }, () => 'void' as TileKind)
  );
  const tileVariant: number[][] = Array.from({ length: GRID_H }, () =>
    Array.from({ length: GRID_W }, () => Math.floor(rng.next() * 4))
  );
  const discovered: boolean[][] = Array.from({ length: GRID_H }, () =>
    Array.from({ length: GRID_W }, () => false)
  );

  // Place rooms in a 3x2 sector layout with randomized jitter so every run's dungeon differs
  // while keeping rooms non-overlapping and connected in an exciting progression path!
  const sectorCoords: Array<{ sx: number; sy: number }> = [
    { sx: 0, sy: 0 },
    { sx: 1, sy: 0 },
    { sx: 2, sy: 0 },
    { sx: 2, sy: 1 },
    { sx: 1, sy: 1 },
    { sx: 0, sy: 1 },
  ];

  // Shuffle middle path slightly on floors > 1
  const roomCount = floorNumber === MAX_FLOORS ? 5 : 5 + (floorNumber >= 2 ? 1 : 0);
  const rooms: RoomRect[] = [];

  const sectorW = 14;
  const sectorH = 19;

  for (let i = 0; i < roomCount; i++) {
    const sec = sectorCoords[i];
    let template: RoomTemplateKind = 'pillar_arena';
    let rw = 9;
    let rh = 9;

    if (i === 0) {
      template = 'entry_courtyard';
      rw = 7;
      rh = 7;
    } else if (i === roomCount - 1 && floorNumber === MAX_FLOORS) {
      template = 'boss_sanctum';
      rw = 11;
      rh = 11;
    } else if (i === 2) {
      template = 'vault_treasury';
      rw = 7;
      rh = 7;
    } else {
      const pool: RoomTemplateKind[] = ['pillar_arena', 'cross_bridge', 'ossuary_hall'];
      template = pickOne(rng, pool);
      if (template === 'ossuary_hall') {
        rw = 11;
        rh = 7;
      } else {
        rw = 9;
        rh = 9;
      }
    }

    const baseX = 3 + sec.sx * sectorW;
    const baseY = 4 + sec.sy * sectorH;
    const maxJitterX = Math.max(0, sectorW - rw - 3);
    const maxJitterY = Math.max(0, sectorH - rh - 4);
    const rx = baseX + randInt(rng, 0, maxJitterX);
    const ry = baseY + randInt(rng, 0, maxJitterY);

    rooms.push({
      id: i,
      x: rx,
      y: ry,
      w: rw,
      h: rh,
      cx: rx + rw * 0.5,
      cy: ry + rh * 0.5,
      template,
      cleared: i === 0,
      discovered: i === 0,
    });
  }

  // Carve corridors between sequential rooms + occasional loop shortcut
  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i];
    const b = rooms[i + 1];
    carveCorridor(tiles, Math.floor(a.cx), Math.floor(a.cy), Math.floor(b.cx), Math.floor(b.cy), rng);
  }
  if (rooms.length >= 5 && rng.next() < 0.7) {
    // Shortcut corridor between room 1 and room 4
    carveCorridor(
      tiles,
      Math.floor(rooms[1].cx),
      Math.floor(rooms[1].cy),
      Math.floor(rooms[4].cx),
      Math.floor(rooms[4].cy),
      rng
    );
  }

  const torches: TorchLight[] = [];
  const props: DestructibleProp[] = [];
  let nextPropId = 1;

  for (const room of rooms) {
    const carved = carveRoomTemplate(tiles, room, rng);
    for (const t of carved.torches) {
      torches.push({ x: t.x, y: t.y, phase: rng.next() * Math.PI * 2 });
    }
    for (const p of carved.props) {
      props.push({
        id: nextPropId++,
        kind: p.kind,
        x: p.x,
        y: p.y,
        hp: p.kind === 'chest' ? 999 : p.kind === 'barrel' ? 28 : 22,
        maxHp: p.kind === 'chest' ? 999 : p.kind === 'barrel' ? 28 : 22,
        hitFlash: 0,
        opened: false,
      });
    }
  }

  // Wrap all walkable tiles with solid walls
  for (let y = 1; y < GRID_H - 1; y++) {
    for (let x = 1; x < GRID_W - 1; x++) {
      if (tiles[y][x] === 'void') {
        let touchesFloor = false;
        for (let dy = -1; dy <= 1 && !touchesFloor; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nt = tiles[y + dy][x + dx];
            if (nt === 'floor' || nt === 'spikes' || nt === 'pillar') {
              touchesFloor = true;
              break;
            }
          }
        }
        if (touchesFloor) {
          tiles[y][x] = 'wall';
        }
      }
    }
  }

  // Spawn & Exit portal placement
  const entry = rooms[0];
  const exitRoom = rooms[rooms.length - 1];
  const spawnX = entry.cx;
  const spawnY = entry.cy;
  const portalX = Math.floor(exitRoom.cx) + 0.5;
  const portalY = Math.floor(exitRoom.cy) + 0.5;
  tiles[Math.floor(portalY)][Math.floor(portalX)] = 'portal';

  // Populate enemies in rooms 1..N (never in entry_courtyard!)
  const enemies: EnemyEntity[] = [];
  let nextEnemyId = 1;

  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i];
    if (room.template === 'boss_sanctum') {
      // Lord Dinglepus + Royal Skeleton Elite Guard + Pyromancers
      enemies.push(makeEnemy(nextEnemyId++, 'boss', room.cx, room.cy, floorNumber, room.id, rng));
      enemies.push(makeEnemy(nextEnemyId++, 'skeleton', room.x + 2.2, room.y + 2.2, floorNumber, room.id, rng));
      enemies.push(makeEnemy(nextEnemyId++, 'skeleton', room.x + room.w - 2.2, room.y + 2.2, floorNumber, room.id, rng));
      enemies.push(makeEnemy(nextEnemyId++, 'skeleton', room.x + 2.2, room.y + room.h - 2.2, floorNumber, room.id, rng));
      enemies.push(makeEnemy(nextEnemyId++, 'skeleton', room.x + room.w - 2.2, room.y + room.h - 2.2, floorNumber, room.id, rng));
      enemies.push(makeEnemy(nextEnemyId++, 'cultist', room.x + room.w * 0.5, room.y + 2.2, floorNumber, room.id, rng));
      enemies.push(makeEnemy(nextEnemyId++, 'cultist', room.x + room.w * 0.5, room.y + room.h - 2.2, floorNumber, room.id, rng));
      continue;
    }

    // High density enemy horde! (8-16 monsters per room)
    const baseCount = 7 + floorNumber * 3 + (room.template === 'ossuary_hall' ? 4 : 0);
    const enemyPool: EnemyKind[] =
      floorNumber === 1
        ? ['skeleton', 'skeleton', 'goblin', 'orc', 'skeleton']
        : floorNumber === 2
          ? ['skeleton', 'goblin', 'orc', 'cultist', 'orc']
          : ['skeleton', 'goblin', 'orc', 'cultist', 'orc', 'cultist'];

    for (let e = 0; e < baseCount; e++) {
      let ex = room.cx;
      let ey = room.cy;
      let found = false;
      for (let attempt = 0; attempt < 18; attempt++) {
        const tx = randInt(rng, room.x + 1, room.x + room.w - 2);
        const ty = randInt(rng, room.y + 1, room.y + room.h - 2);
        if (tiles[ty][tx] === 'floor') {
          ex = tx + 0.5;
          ey = ty + 0.5;
          // Avoid overlapping props or portal
          const nearPortal = Math.hypot(ex - portalX, ey - portalY) < 1.2;
          const nearProp = props.some((p) => Math.hypot(p.x - ex, p.y - ey) < 0.9);
          if (!nearPortal && !nearProp) {
            found = true;
            break;
          }
        }
      }
      if (found) {
        const kind = pickOne(rng, enemyPool);
        enemies.push(makeEnemy(nextEnemyId++, kind, ex, ey, floorNumber, room.id, rng));
      }
    }
  }

  return {
    floorNumber,
    themeName: palette.name,
    width: GRID_W,
    height: GRID_H,
    tiles,
    tileVariant,
    discovered,
    rooms,
    spawnX,
    spawnY,
    portalX,
    portalY,
    portalOpen: false,
    torches,
    props,
    enemies,
  };
}
