import { HERO_CLASSES, PET_CONFIGS } from './constants';
import type { HeroClassId, PersistentProgress, PetId } from './types';

const STORAGE_KEY = 'dungeon_rampage_save_v1';

export function getDefaultProgress(): PersistentProgress {
  return {
    bankCoins: 0,
    unlockedHeroes: ['berserker'],
    unlockedPets: ['wolf'],
    selectedHero: 'berserker',
    selectedPet: 'wolf',
    bestScore: 0,
  };
}

export function loadProgress(): PersistentProgress {
  const def = getDefaultProgress();
  if (typeof window === 'undefined' || !window.localStorage) return def;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw) as Partial<PersistentProgress>;
    const unlockedHeroes: HeroClassId[] = Array.isArray(parsed.unlockedHeroes)
      ? parsed.unlockedHeroes.filter((h): h is HeroClassId => h in HERO_CLASSES)
      : ['berserker'];
    if (!unlockedHeroes.includes('berserker')) unlockedHeroes.unshift('berserker');

    const unlockedPets: PetId[] = Array.isArray(parsed.unlockedPets)
      ? parsed.unlockedPets.filter((p): p is PetId => p in PET_CONFIGS)
      : ['wolf'];
    if (!unlockedPets.includes('wolf')) unlockedPets.unshift('wolf');

    const selectedHero =
      parsed.selectedHero && unlockedHeroes.includes(parsed.selectedHero)
        ? parsed.selectedHero
        : 'berserker';
    const selectedPet =
      parsed.selectedPet && (parsed.selectedPet === 'none' || unlockedPets.includes(parsed.selectedPet))
        ? parsed.selectedPet
        : 'wolf';

    return {
      bankCoins: typeof parsed.bankCoins === 'number' && parsed.bankCoins >= 0 ? Math.floor(parsed.bankCoins) : 0,
      unlockedHeroes,
      unlockedPets,
      selectedHero,
      selectedPet,
      bestScore: typeof parsed.bestScore === 'number' && parsed.bestScore >= 0 ? Math.floor(parsed.bestScore) : 0,
    };
  } catch {
    return def;
  }
}

export function saveProgress(progress: PersistentProgress): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore storage quota errors
  }
}

export function tryUnlockHero(progress: PersistentProgress, heroId: HeroClassId): PersistentProgress | null {
  if (progress.unlockedHeroes.includes(heroId)) {
    return { ...progress, selectedHero: heroId };
  }
  const cost = HERO_CLASSES[heroId].unlockCost;
  if (progress.bankCoins < cost) return null;
  return {
    ...progress,
    bankCoins: progress.bankCoins - cost,
    unlockedHeroes: [...progress.unlockedHeroes, heroId],
    selectedHero: heroId,
  };
}

export function tryUnlockPet(progress: PersistentProgress, petId: PetId): PersistentProgress | null {
  if (petId === 'none' || progress.unlockedPets.includes(petId)) {
    return { ...progress, selectedPet: petId };
  }
  const cost = PET_CONFIGS[petId].unlockCost;
  if (progress.bankCoins < cost) return null;
  return {
    ...progress,
    bankCoins: progress.bankCoins - cost,
    unlockedPets: [...progress.unlockedPets, petId],
    selectedPet: petId,
  };
}
