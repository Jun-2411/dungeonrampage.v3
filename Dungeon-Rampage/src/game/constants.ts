import type { HeroClassConfig, HeroClassId, PetConfig, PetId, WeaponRarity } from './types';

export const TILE_HALF_W = 36;
export const TILE_HALF_H = 18;
export const WALL_HEIGHT = 38;
export const PILLAR_HEIGHT = 44;

export const MAX_FLOORS = 3;
export const MAX_PARTICLES = 650;
export const MAX_ATTACK_TOKENS = 8;

export const RARITY_COLORS: Record<WeaponRarity, string> = {
  common: '#cbd5e1',
  rare: '#38bdf8',
  epic: '#c084fc',
  legendary: '#fbbf24',
};

export const RARITY_LABELS: Record<WeaponRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

export const HERO_CLASSES: Record<HeroClassId, HeroClassConfig> = {
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    role: 'Heavy Cleave · Whirlwind',
    busterName: 'Whirlwind Buster',
    unlockCost: 0,
    maxHp: 145,
    speed: 4.5,
    attackDamage: 28,
    attackRange: 2.0,
    attackCooldown: 0.34,
    attackArc: Math.PI * 0.84,
    isRanged: false,
    dashCooldown: 1.15,
    primaryColor: '#dc2626',
    accentColor: '#fbbf24',
    capeColor: '#7f1d1d',
    weapons: [
      { id: 'b_common', name: 'Iron Broadaxe', rarity: 'common', damageBonus: 0, rangeBonus: 0, speedMult: 1, color: '#cbd5e1' },
      { id: 'b_rare', name: 'Cobalt Twinaxe', rarity: 'rare', damageBonus: 12, rangeBonus: 0.25, speedMult: 1.1, color: '#38bdf8' },
      { id: 'b_epic', name: 'Bloodmoon Cleaver', rarity: 'epic', damageBonus: 28, rangeBonus: 0.45, speedMult: 1.2, color: '#c084fc' },
      { id: 'b_legendary', name: 'Dinglepus Doomaxe', rarity: 'legendary', damageBonus: 55, rangeBonus: 0.7, speedMult: 1.35, color: '#fbbf24' },
    ],
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    role: 'Piercing Bow · Agile Roll',
    busterName: 'Arrow Storm Buster',
    unlockCost: 120,
    maxHp: 115,
    speed: 5.25,
    attackDamage: 24,
    attackRange: 9.6,
    attackCooldown: 0.24,
    attackArc: 0,
    isRanged: true,
    dashCooldown: 0.9,
    primaryColor: '#10b981',
    accentColor: '#fde68a',
    capeColor: '#064e3b',
    weapons: [
      { id: 'r_common', name: 'Ashwood Bow', rarity: 'common', damageBonus: 0, rangeBonus: 0, speedMult: 1, color: '#cbd5e1' },
      { id: 'r_rare', name: 'Falcon Recurve', rarity: 'rare', damageBonus: 12, rangeBonus: 1.2, speedMult: 1.15, color: '#38bdf8' },
      { id: 'r_epic', name: 'Shadowhorn Longbow', rarity: 'epic', damageBonus: 25, rangeBonus: 2.0, speedMult: 1.25, color: '#c084fc' },
      { id: 'r_legendary', name: 'Starfall Windbow', rarity: 'legendary', damageBonus: 50, rangeBonus: 3.0, speedMult: 1.4, color: '#fbbf24' },
    ],
  },
  sorcerer: {
    id: 'sorcerer',
    name: 'Sorcerer',
    role: 'Arcane Bolts · Meteor Nova',
    busterName: 'Meteor Nova Buster',
    unlockCost: 180,
    maxHp: 105,
    speed: 4.75,
    attackDamage: 28,
    attackRange: 8.4,
    attackCooldown: 0.28,
    attackArc: 0,
    isRanged: true,
    dashCooldown: 1.05,
    primaryColor: '#f59e0b',
    accentColor: '#60a5fa',
    capeColor: '#1e3a8a',
    weapons: [
      { id: 's_common', name: 'Apprentice Rod', rarity: 'common', damageBonus: 0, rangeBonus: 0, speedMult: 1, color: '#cbd5e1' },
      { id: 's_rare', name: 'Sapphire Conduit', rarity: 'rare', damageBonus: 14, rangeBonus: 1.0, speedMult: 1.12, color: '#38bdf8' },
      { id: 's_epic', name: 'Astral Spire Staff', rarity: 'epic', damageBonus: 28, rangeBonus: 1.8, speedMult: 1.22, color: '#c084fc' },
      { id: 's_legendary', name: 'Sunfire Archstaff', rarity: 'legendary', damageBonus: 52, rangeBonus: 2.5, speedMult: 1.35, color: '#fbbf24' },
    ],
  },
  battle: {
    id: 'battle',
    name: 'Battle',
    role: 'Warhammer · Iron Bulwark',
    busterName: 'Titan Quake Buster',
    unlockCost: 240,
    maxHp: 165,
    speed: 4.2,
    attackDamage: 34,
    attackRange: 2.1,
    attackCooldown: 0.35,
    attackArc: Math.PI * 0.95,
    isRanged: false,
    dashCooldown: 1.2,
    primaryColor: '#3b82f6',
    accentColor: '#e2e8f0',
    capeColor: '#1e293b',
    weapons: [
      { id: 'bt_common', name: 'Bronze Maul', rarity: 'common', damageBonus: 0, rangeBonus: 0, speedMult: 1, color: '#cbd5e1' },
      { id: 'bt_rare', name: 'Knight Warhammer', rarity: 'rare', damageBonus: 15, rangeBonus: 0.25, speedMult: 1.1, color: '#38bdf8' },
      { id: 'bt_epic', name: 'Cragbreaker Mace', rarity: 'epic', damageBonus: 30, rangeBonus: 0.45, speedMult: 1.2, color: '#c084fc' },
      { id: 'bt_legendary', name: 'Aegis Thunderhammer', rarity: 'legendary', damageBonus: 58, rangeBonus: 0.65, speedMult: 1.32, color: '#fbbf24' },
    ],
  },
  vampire_hunter: {
    id: 'vampire_hunter',
    name: 'Vampire Hunter',
    role: 'Twin Crossbow · Silver Stakes',
    busterName: 'Silver Volley Buster',
    unlockCost: 300,
    maxHp: 120,
    speed: 5.05,
    attackDamage: 24,
    attackRange: 8.8,
    attackCooldown: 0.22,
    attackArc: 0,
    isRanged: true,
    dashCooldown: 0.95,
    primaryColor: '#9f1239',
    accentColor: '#e2e8f0',
    capeColor: '#311022',
    weapons: [
      { id: 'vh_common', name: 'Oak Handbow', rarity: 'common', damageBonus: 0, rangeBonus: 0, speedMult: 1, color: '#cbd5e1' },
      { id: 'vh_rare', name: 'Silver Repeaters', rarity: 'rare', damageBonus: 12, rangeBonus: 1.0, speedMult: 1.15, color: '#38bdf8' },
      { id: 'vh_epic', name: 'Crimson Stakeshooter', rarity: 'epic', damageBonus: 26, rangeBonus: 1.8, speedMult: 1.28, color: '#c084fc' },
      { id: 'vh_legendary', name: 'Nightbane Arbalester', rarity: 'legendary', damageBonus: 50, rangeBonus: 2.6, speedMult: 1.45, color: '#fbbf24' },
    ],
  },
  chef_samurai: {
    id: 'chef_samurai',
    name: 'Chef Ghost Samurai',
    role: 'Spectral Blade · Rapid Combo',
    busterName: 'Phantom Feast Buster',
    unlockCost: 360,
    maxHp: 130,
    speed: 5.1,
    attackDamage: 28,
    attackRange: 2.2,
    attackCooldown: 0.25,
    attackArc: Math.PI * 0.85,
    isRanged: false,
    dashCooldown: 0.88,
    primaryColor: '#2dd4bf',
    accentColor: '#fef08a',
    capeColor: '#134e4a',
    weapons: [
      { id: 'cs_common', name: 'Iron Cleaver', rarity: 'common', damageBonus: 0, rangeBonus: 0, speedMult: 1, color: '#cbd5e1' },
      { id: 'cs_rare', name: 'Ghost Sashimi Blade', rarity: 'rare', damageBonus: 14, rangeBonus: 0.25, speedMult: 1.15, color: '#38bdf8' },
      { id: 'cs_epic', name: 'Jade Wok-Katana', rarity: 'epic', damageBonus: 28, rangeBonus: 0.45, speedMult: 1.25, color: '#c084fc' },
      { id: 'cs_legendary', name: 'Spirit Master Masamune', rarity: 'legendary', damageBonus: 54, rangeBonus: 0.65, speedMult: 1.4, color: '#fbbf24' },
    ],
  },
};

export const HERO_LIST: HeroClassConfig[] = [
  HERO_CLASSES.berserker,
  HERO_CLASSES.ranger,
  HERO_CLASSES.sorcerer,
  HERO_CLASSES.battle,
  HERO_CLASSES.vampire_hunter,
  HERO_CLASSES.chef_samurai,
];

export const PET_CONFIGS: Record<PetId, PetConfig> = {
  none: {
    id: 'none',
    name: 'No Pet',
    role: 'Solo Run',
    unlockCost: 0,
    speed: 0,
    damage: 0,
    attackCooldown: 1,
    isRanged: false,
    knockback: 0,
    primaryColor: '#64748b',
    accentColor: '#94a3b8',
  },
  wolf: {
    id: 'wolf',
    name: 'Timber Wolf',
    role: 'Swift Fang Chaser',
    unlockCost: 0,
    speed: 6.2,
    damage: 26,
    attackCooldown: 0.55,
    isRanged: false,
    knockback: 3.5,
    primaryColor: '#94a3b8',
    accentColor: '#e2e8f0',
  },
  rhino: {
    id: 'rhino',
    name: 'Iron Rhino',
    role: 'Heavy Horn Charge',
    unlockCost: 160,
    speed: 5.2,
    damage: 54,
    attackCooldown: 0.9,
    isRanged: false,
    knockback: 9.5,
    primaryColor: '#78716c',
    accentColor: '#fde68a',
  },
  dragon: {
    id: 'dragon',
    name: 'Ember Dragon',
    role: 'Ranged Firebreath',
    unlockCost: 280,
    speed: 5.8,
    damage: 42,
    attackCooldown: 0.72,
    isRanged: true,
    knockback: 4.5,
    primaryColor: '#ef4444',
    accentColor: '#fbbf24',
  },
};

export const PET_LIST: PetConfig[] = [
  PET_CONFIGS.wolf,
  PET_CONFIGS.rhino,
  PET_CONFIGS.dragon,
];

export interface FloorPalette {
  name: string;
  floorLight: string;
  floorDark: string;
  floorStroke: string;
  wallTop: string;
  wallLeft: string;
  wallRight: string;
  ambientGlow: string;
  fogBg: string;
}

export const FLOOR_PALETTES: Record<number, FloorPalette> = {
  1: {
    name: 'Stone Catacombs',
    floorLight: '#2c2934',
    floorDark: '#24212b',
    floorStroke: '#1a1720',
    wallTop: '#4a4557',
    wallLeft: '#353140',
    wallRight: '#26232e',
    ambientGlow: 'rgba(245, 158, 11, 0.14)',
    fogBg: '#0e0c11',
  },
  2: {
    name: 'Obsidian Vaults',
    floorLight: '#212936',
    floorDark: '#1b222d',
    floorStroke: '#12171f',
    wallTop: '#3a4659',
    wallLeft: '#293342',
    wallRight: '#1d2430',
    ambientGlow: 'rgba(56, 189, 248, 0.13)',
    fogBg: '#0a0e14',
  },
  3: {
    name: "Dinglepus's Crimson Sanctum",
    floorLight: '#312026',
    floorDark: '#27191e',
    floorStroke: '#1b1115',
    wallTop: '#54353d',
    wallLeft: '#3d252b',
    wallRight: '#2a181d',
    ambientGlow: 'rgba(239, 68, 68, 0.16)',
    fogBg: '#120a0d',
  },
};
