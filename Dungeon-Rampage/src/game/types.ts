export type GameState = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type HeroClassId =
  | 'berserker'
  | 'ranger'
  | 'sorcerer'
  | 'battle'
  | 'vampire_hunter'
  | 'chef_samurai';

export type WeaponRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface WeaponDef {
  id: string;
  name: string;
  rarity: WeaponRarity;
  damageBonus: number;
  rangeBonus: number;
  speedMult: number;
  color: string;
}

export interface HeroClassConfig {
  id: HeroClassId;
  name: string;
  role: string;
  busterName: string;
  unlockCost: number;
  maxHp: number;
  speed: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  attackArc: number; // radians; 0 for projectile
  isRanged: boolean;
  dashCooldown: number;
  primaryColor: string;
  accentColor: string;
  capeColor: string;
  weapons: WeaponDef[];
}

export type PetId = 'none' | 'wolf' | 'rhino' | 'dragon';

export interface PetConfig {
  id: PetId;
  name: string;
  role: string;
  unlockCost: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  isRanged: boolean;
  knockback: number;
  primaryColor: string;
  accentColor: string;
}

export interface PetEntity {
  id: PetId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  attackCooldown: number;
  gaitDist: number;
  squashX: number;
  squashY: number;
  lungeTimer: number;
}

export type TileKind = 'void' | 'floor' | 'wall' | 'pillar' | 'spikes' | 'portal';

export type RoomTemplateKind =
  | 'entry_courtyard'
  | 'pillar_arena'
  | 'cross_bridge'
  | 'vault_treasury'
  | 'ossuary_hall'
  | 'boss_sanctum';

export interface RoomRect {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  template: RoomTemplateKind;
  cleared: boolean;
  discovered: boolean;
}

export interface TorchLight {
  x: number;
  y: number;
  phase: number;
}

export type PropKind = 'crate' | 'barrel' | 'urn' | 'chest';

export interface DestructibleProp {
  id: number;
  kind: PropKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
  opened?: boolean;
}

export type PickupKind = 'coin' | 'xp' | 'food' | 'mana' | 'weapon';

export interface PickupItem {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  z: number;
  vz: number;
  value: number;
  age: number;
  weaponDef?: WeaponDef;
}

export type EnemyKind = 'skeleton' | 'goblin' | 'orc' | 'cultist' | 'boss';

export type EnemyState =
  | 'idle'
  | 'chase'
  | 'kite'
  | 'windup'
  | 'attack'
  | 'recover'
  | 'stunned'
  | 'dying';

export interface EnemyEntity {
  id: number;
  kind: EnemyKind;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  damage: number;
  state: EnemyState;
  stateTimer: number;
  windupDuration: number;
  attackCooldown: number;
  hitFlash: number;
  squashX: number;
  squashY: number;
  gaitDist: number;
  deathTimer: number;
  hasToken: boolean;
  aimAngle: number;
  targetX: number;
  targetY: number;
  phase: number;
  roomId: number;
  isElite?: boolean;
}

export interface Projectile {
  id: number;
  fromPlayer: boolean;
  kind: 'arrow' | 'arcane' | 'bolt' | 'stake' | 'fireball' | 'boss_orb';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  pierce: number;
  hitIds: number[];
  color: string;
}

export interface HazardZone {
  id: number;
  x: number;
  y: number;
  radius: number;
  timer: number;
  duration: number;
  triggered: boolean;
  damage: number;
}

export interface FloatingText {
  x: number;
  y: number;
  z: number;
  vz: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface SlashArcEffect {
  x: number;
  y: number;
  angle: number;
  arc: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  comboStep: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  gravity: number;
}

export interface DungeonFloorData {
  floorNumber: number;
  themeName: string;
  width: number;
  height: number;
  tiles: TileKind[][];
  tileVariant: number[][];
  discovered: boolean[][];
  rooms: RoomRect[];
  spawnX: number;
  spawnY: number;
  portalX: number;
  portalY: number;
  portalOpen: boolean;
  torches: TorchLight[];
  props: DestructibleProp[];
  enemies: EnemyEntity[];
}

export interface PersistentProgress {
  bankCoins: number;
  unlockedHeroes: HeroClassId[];
  unlockedPets: PetId[];
  selectedHero: HeroClassId;
  selectedPet: PetId;
  bestScore: number;
}

export interface HudSnapshot {
  gameState: GameState;
  heroClass: HeroClassId;
  petId: PetId;
  weapon: WeaponDef;
  weaponLevel: number;
  weaponUpgradeCost: number;
  canUpgradeWeapon: boolean;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  ghostHp: number;
  buster: number;
  maxBuster: number;
  busterReady: boolean;
  dashReadyRatio: number;
  floor: number;
  maxFloors: number;
  floorTheme: string;
  enemiesRemaining: number;
  totalEnemies: number;
  portalOpen: boolean;
  score: number;
  bestScore: number;
  runCoins: number;
  bankCoins: number;
  combo: number;
  maxCombo: number;
  kills: number;
  elapsedSeconds: number;
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
  muted: boolean;
  bannerText: string | null;
}
