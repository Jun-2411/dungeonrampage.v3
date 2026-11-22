import { useEffect } from 'react';
import { HERO_LIST, PET_LIST } from '../game/constants';
import type { HeroClassId, PersistentProgress, PetId } from '../game/types';
import { HeroEmblemSvg, PetEmblemSvg } from './HeroIcons';

interface TitleOverlayProps {
  progress: PersistentProgress;
  onSelectOrUnlockHero: (heroId: HeroClassId) => void;
  onSelectOrUnlockPet: (petId: PetId) => void;
  onStart: () => void;
}

export function TitleOverlay({
  progress,
  onSelectOrUnlockHero,
  onSelectOrUnlockPet,
  onStart,
}: TitleOverlayProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onStart]);

  const selectedHero = HERO_LIST.find((h) => h.id === progress.selectedHero) ?? HERO_LIST[0];

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-none">
      {/* Subtle dark atmospheric scrim on left/bottom for contrast without backdrop-filter */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 72% 42%, rgba(14,12,15,0.22) 0%, rgba(14,12,15,0.78) 62%, rgba(14,12,15,0.92) 100%)',
        }}
      />

      {/* Top row: Quiet coin treasury & best score */}
      <div className="relative flex items-center justify-between">
        <div className="text-xs tracking-widest uppercase text-[#a89f91]">
          Citadel of Lord Dinglepus
        </div>
        <div className="flex items-center gap-5 text-sm font-mono-num text-[#f5efe6] hud-stroke">
          <span>
            <span className="text-[#a89f91] mr-1.5">COINS</span>
            <span className="text-[#fbbf24] font-bold">{progress.bankCoins}</span>
          </span>
          {progress.bestScore > 0 && (
            <span>
              <span className="text-[#a89f91] mr-1.5">BEST</span>
              <span className="font-bold">{progress.bestScore}</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area: Left Title Lockup + Roster over calm negative space */}
      <div className="relative my-auto max-w-3xl flex flex-col gap-5 pointer-events-auto">
        {/* Bespoke inline SVG Title Lockup */}
        <div className="flex items-center gap-4">
          <svg viewBox="0 0 72 72" className="w-16 h-16 shrink-0" aria-hidden="true">
            <polygon
              points="36,4 64,18 64,54 36,68 8,54 8,18"
              fill="#1b161d"
              stroke="#b45309"
              strokeWidth="2.5"
            />
            <path d="M22 50L50 22M50 50L22 22" stroke="#e2e8f0" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M44 16c5 1 9 5 10 10l-9 2-3-3 2-9z" fill="#dc2626" stroke="#fbbf24" strokeWidth="1.4" />
            <path d="M28 16c-5 1-9 5-10 10l9 2 3-3-2-9z" fill="#dc2626" stroke="#fbbf24" strokeWidth="1.4" />
            <circle cx="36" cy="36" r="6" fill="#fbbf24" stroke="#0e0c0f" strokeWidth="2" />
          </svg>
          <div>
            <h1 className="font-display text-4xl md:text-6xl font-extrabold tracking-wide text-[#f5efe6] hud-stroke leading-none">
              DUNGEON RAMPAGE
            </h1>
            <p className="mt-1.5 text-sm md:text-base text-[#cfc6b8] max-w-xl">
              Smash through shifting chambers, fill your Dungeon Buster, and overthrow Lord Dinglepus.
            </p>
          </div>
        </div>

        {/* Hero Roster Selector (6 Iconic Heroes) */}
        <div className="bg-[#151218]/90 border border-[#3d342c] rounded-lg p-3.5 shadow-2xl">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs uppercase tracking-wider text-[#b8ae9e] font-semibold">
              Choose Hero ({progress.unlockedHeroes.length}/6 Unlocked)
            </span>
            <span className="text-xs text-[#fbbf24] font-medium">
              {selectedHero.name} · {selectedHero.busterName}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {HERO_LIST.map((hero) => {
              const unlocked = progress.unlockedHeroes.includes(hero.id);
              const selected = progress.selectedHero === hero.id;
              const canAfford = progress.bankCoins >= hero.unlockCost;
              return (
                <button
                  key={hero.id}
                  type="button"
                  onClick={() => onSelectOrUnlockHero(hero.id)}
                  disabled={!unlocked && !canAfford}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded border text-left transition-colors ${
                    selected
                      ? 'bg-[#2a211b] border-[#f59e0b] text-[#fffbeb]'
                      : unlocked
                        ? 'bg-[#1c1820] border-[#352e3b] text-[#e7e0d6] hover:border-[#6b5c4d]'
                        : canAfford
                          ? 'bg-[#1b1a14] border-[#854d0e] text-[#fde68a] hover:bg-[#292315]'
                          : 'bg-[#141116] border-[#26212b] text-[#6d6673] opacity-75 cursor-not-allowed'
                  }`}
                >
                  <HeroEmblemSvg heroId={hero.id} className="w-6 h-6 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{hero.name}</div>
                    <div className="text-[11px] truncate opacity-80">
                      {unlocked ? hero.role.split('·')[0].trim() : `Unlock ${hero.unlockCost}g`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Companion Pets Row */}
          <div className="mt-3 pt-3 border-t border-[#2d2633] flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wider text-[#b8ae9e] font-semibold">
              Companion Pet
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {PET_LIST.map((pet) => {
                const unlocked = progress.unlockedPets.includes(pet.id);
                const selected = progress.selectedPet === pet.id;
                const canAfford = progress.bankCoins >= pet.unlockCost;
                return (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => onSelectOrUnlockPet(pet.id)}
                    disabled={!unlocked && !canAfford}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs transition-colors ${
                      selected
                        ? 'bg-[#2a211b] border-[#f59e0b] text-[#fffbeb]'
                        : unlocked
                          ? 'bg-[#1c1820] border-[#352e3b] text-[#e7e0d6] hover:border-[#6b5c4d]'
                          : canAfford
                            ? 'bg-[#1b1a14] border-[#854d0e] text-[#fde68a]'
                            : 'bg-[#141116] border-[#26212b] text-[#6d6673] opacity-75 cursor-not-allowed'
                    }`}
                  >
                    <PetEmblemSvg petId={pet.id} className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">
                      {unlocked ? pet.name : `${pet.name} (${pet.unlockCost}g)`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Primary Start CTA */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className="font-display px-8 py-3.5 text-base md:text-lg font-bold tracking-wide bg-[#d97706] hover:bg-[#b45309] active:translate-y-0.5 text-[#0e0c0f] rounded border border-[#fde68a]/60 shadow-lg transition-transform whitespace-nowrap"
          >
            Start Rampage
          </button>
          <span className="text-xs text-[#a89f91] whitespace-nowrap">
            Press Enter or Space to begin
          </span>
        </div>
      </div>

      {/* Single flat borderless control-hint line */}
      <div className="relative text-center text-xs md:text-sm text-[#b8ae9e] tracking-wide">
        WASD Move · Click / J Attack · Space Dash · K Dungeon Buster · Esc Pause
      </div>
    </div>
  );
}
