import type { RefObject } from 'react';
import { HERO_CLASSES, PET_CONFIGS, RARITY_LABELS } from '../game/constants';
import type { HudSnapshot } from '../game/types';
import { HeroEmblemSvg, PetEmblemSvg } from './HeroIcons';

interface HudOverlayProps {
  hud: HudSnapshot;
  minimapRef: RefObject<HTMLCanvasElement | null>;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  onUpgradeWeapon: () => void;
}

export function HudOverlay({
  hud,
  minimapRef,
  onToggleMute,
  onPause,
  onRestart,
  onUpgradeWeapon,
}: HudOverlayProps) {
  const heroCfg = HERO_CLASSES[hud.heroClass];
  const petCfg = PET_CONFIGS[hud.petId];
  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100));
  const ghostPct = Math.max(hpPct, Math.min(100, (hud.ghostHp / Math.max(1, hud.maxHp)) * 100));
  const busterPct = Math.max(0, Math.min(100, (hud.buster / Math.max(1, hud.maxBuster)) * 100));
  const xpPct = Math.max(0, Math.min(100, (hud.xp / Math.max(1, hud.xpToNext)) * 100));

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-5">
      {/* Top Row: Left Vitality Cluster · Center Floor/Boss · Right Score & Utilities */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Forged Iron Vitality & Dungeon Buster Cluster */}
        <div className="flex items-start gap-3 bg-[#151218]/90 border border-[#3d342c] rounded px-3.5 py-2.5 shadow-lg">
          <div className="flex flex-col items-center gap-1 pt-0.5">
            <div className="w-10 h-10 rounded bg-[#211b24] border border-[#524539] flex items-center justify-center">
              <HeroEmblemSvg heroId={hud.heroClass} className="w-7 h-7" />
            </div>
            <span className="text-[11px] font-mono-num font-bold text-[#fbbf24]">
              LV {hud.level}
            </span>
          </div>

          <div className="w-44 md:w-52 flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-display font-bold text-[#f5efe6] truncate">
                {heroCfg.name}
              </span>
              <span className="font-mono-num text-[#fca5a5] font-bold">
                {hud.hp}/{hud.maxHp}
              </span>
            </div>

            {/* HP Bar with delayed drain ghost bar */}
            <div className="relative h-3 bg-[#0c0a0d] border border-[#3d342c] rounded-sm overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[#fde68a]/75 transition-none"
                style={{ width: `${ghostPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-[#dc2626] transition-none"
                style={{ width: `${hpPct}%` }}
              />
            </div>

            {/* Dungeon Buster Meter */}
            <div className="flex items-center justify-between text-[11px] leading-none mt-0.5">
              <span className={hud.busterReady ? 'text-[#fbbf24] font-bold' : 'text-[#a89f91]'}>
                {hud.busterReady ? 'BUSTER READY [K]' : 'Dungeon Buster'}
              </span>
              <span className="font-mono-num text-[#7dd3fc]">{hud.buster}%</span>
            </div>
            <div className="relative h-2 bg-[#0c0a0d] border border-[#2d3647] rounded-sm overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 ${hud.busterReady ? 'bg-[#f59e0b]' : 'bg-[#0284c7]'}`}
                style={{ width: `${busterPct}%` }}
              />
            </div>

            {/* Weapon + Level + Forge Button + Pet */}
            <div className="flex items-center justify-between text-[11px] pt-0.5 gap-1.5">
              <div className="flex items-center gap-1 min-w-0 truncate">
                <span className="truncate font-medium" style={{ color: hud.weapon.color }}>
                  {RARITY_LABELS[hud.weapon.rarity]} {hud.weapon.name}
                </span>
                <span className="font-mono-num font-bold text-[#38bdf8] shrink-0 text-[10px] bg-[#0c1e30] border border-[#0284c7]/40 px-1 rounded">
                  +{hud.weaponLevel}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 pointer-events-auto">
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Forge weapon +1 (U)"
                  title={`Forge Weapon (+1 Lv, ${hud.weaponUpgradeCost} coins) [U]`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onUpgradeWeapon();
                  }}
                  disabled={!hud.canUpgradeWeapon}
                  className={`text-[10px] font-mono-num font-bold px-1.5 py-0.5 rounded border transition-colors ${
                    hud.canUpgradeWeapon
                      ? 'bg-[#b45309] hover:bg-[#d97706] text-[#fef3c7] border-[#fbbf24] shadow cursor-pointer'
                      : 'bg-[#221c1f] text-[#71686a] border-[#3f3438] cursor-not-allowed opacity-60'
                  }`}
                >
                  {hud.weaponLevel >= 10 ? 'MAX' : `[U] +${hud.weaponUpgradeCost}g`}
                </button>
                {hud.petId !== 'none' && (
                  <span className="flex items-center gap-1 text-[#cfc6b8]">
                    <PetEmblemSvg petId={hud.petId} className="w-3.5 h-3.5" />
                    <span>{petCfg.name.split(' ')[1] ?? petCfg.name}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="h-1 bg-[#0c0a0d] rounded-full overflow-hidden">
              <div className="h-full bg-[#a855f7]" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>

        {/* Top-Center: Floor / Boss / Combo / Banner */}
        <div className="flex flex-col items-center gap-2">
          <div className="bg-[#151218]/90 border border-[#3d342c] rounded px-4 py-1.5 text-center shadow-lg">
            <div className="text-[11px] uppercase tracking-wider text-[#b8ae9e]">
              Floor {hud.floor}/{hud.maxFloors} · {hud.floorTheme}
            </div>
            <div className="font-mono-num text-sm font-bold text-[#f5efe6]">
              {hud.portalOpen
                ? 'EXIT PORTAL OPEN'
                : `${hud.enemiesRemaining} Foes Remaining`}
            </div>
          </div>

          {hud.bossName && (
            <div className="w-72 md:w-96 bg-[#1a1115]/95 border border-[#991b1b] rounded px-3.5 py-2 shadow-xl">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-display font-bold text-[#fca5a5] tracking-wide">
                  {hud.bossName}
                </span>
                <span className="font-mono-num text-[#f5efe6]">
                  {hud.bossHp}/{hud.bossMaxHp}
                </span>
              </div>
              <div className="h-2.5 bg-[#0e0c0f] border border-[#450a0a] rounded-sm overflow-hidden">
                <div
                  className="h-full bg-[#ef4444]"
                  style={{ width: `${Math.max(0, (hud.bossHp / Math.max(1, hud.bossMaxHp)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {hud.combo >= 2 && (
            <div className="font-display text-lg font-extrabold text-[#fbbf24] hud-stroke tracking-wider">
              {hud.combo}× RAMPAGE
            </div>
          )}

          {hud.bannerText && (
            <div className="mt-1 px-4 py-1.5 bg-[#1b161d]/95 border border-[#b45309] rounded text-xs md:text-sm font-display font-bold text-[#fef3c7] shadow-lg">
              {hud.bannerText}
            </div>
          )}
        </div>

        {/* Top-Right: Gold / Score + Utility Buttons */}
        <div className="flex items-start gap-3">
          <div className="bg-[#151218]/90 border border-[#3d342c] rounded px-3.5 py-2 text-right shadow-lg font-mono-num">
            <div className="text-[11px] uppercase tracking-wider text-[#b8ae9e]">Score</div>
            <div className="text-lg font-bold text-[#f5efe6] leading-tight">{hud.score}</div>
            <div className="text-xs text-[#fbbf24] font-semibold mt-0.5">
              +{hud.runCoins} Coins
            </div>
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              aria-label={hud.muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
              title="Mute [M]"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-9 h-9 rounded bg-[#151218]/90 border border-[#3d342c] hover:border-[#f59e0b] text-[#e7e0d6] flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                {hud.muted ? (
                  <path d="M23 9l-6 6M17 9l6 6" stroke="#ef4444" />
                ) : (
                  <path d="M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" />
                )}
              </svg>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause game (P)"
              title="Pause [P]"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-9 h-9 rounded bg-[#151218]/90 border border-[#3d342c] hover:border-[#f59e0b] text-[#e7e0d6] flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Restart run (R)"
              title="Restart [R]"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="w-9 h-9 rounded bg-[#151218]/90 border border-[#3d342c] hover:border-[#f59e0b] text-[#e7e0d6] flex items-center justify-center"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 103-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Subtle control hint left · Live Geometry Minimap right */}
      <div className="flex items-end justify-between">
        <div className="text-[11px] text-[#a89f91]/85 hud-stroke hidden sm:block">
          WASD Move · Click / J Attack · Space Dash · K Buster · U Forge Weapon
        </div>
        <div className="bg-[#151218]/90 border border-[#3d342c] rounded p-1.5 shadow-lg">
          <canvas
            ref={minimapRef}
            width={120}
            height={120}
            data-testid="minimap-canvas"
            className="block w-[112px] h-[112px] rounded-sm"
          />
        </div>
      </div>
    </div>
  );
}
