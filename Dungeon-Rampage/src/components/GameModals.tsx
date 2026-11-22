import type { HudSnapshot } from '../game/types';

interface GameModalsProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function GameModals({
  hud,
  onResume,
  onRestart,
  onReturnTitle,
}: GameModalsProps) {
  if (hud.gameState === 'title' || hud.gameState === 'playing') {
    return null;
  }

  const isPaused = hud.gameState === 'paused';
  const isVictory = hud.gameState === 'victory';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#0a080c]/75">
      <div className="w-full max-w-md bg-[#16131a] border border-[#4a3e33] rounded-lg p-6 shadow-2xl text-center">
        <h2
          className={`font-display text-3xl font-extrabold tracking-wide ${
            isVictory ? 'text-[#fbbf24]' : isPaused ? 'text-[#f5efe6]' : 'text-[#ef4444]'
          }`}
        >
          {isPaused ? 'Paused' : isVictory ? 'Lord Dinglepus Defeated' : 'Defeated'}
        </h2>
        <p className="mt-1.5 text-sm text-[#b8ae9e]">
          {isPaused
            ? `Floor ${hud.floor} · ${hud.floorTheme}`
            : isVictory
              ? 'You conquered the Citadel and claimed the treasury!'
              : `Fell on Floor ${hud.floor} (${hud.floorTheme}).`}
        </p>

        {/* 3-Stat Tabular Summary */}
        <div className="mt-5 grid grid-cols-3 gap-2.5 text-center">
          <div className="bg-[#1e1922] border border-[#342c3a] rounded p-3">
            <div className="text-[11px] uppercase tracking-wider text-[#a89f91]">Score</div>
            <div className="mt-1 font-mono-num text-lg font-bold text-[#f5efe6]">{hud.score}</div>
          </div>
          <div className="bg-[#1e1922] border border-[#342c3a] rounded p-3">
            <div className="text-[11px] uppercase tracking-wider text-[#a89f91]">Coins</div>
            <div className="mt-1 font-mono-num text-lg font-bold text-[#fbbf24]">+{hud.runCoins}</div>
          </div>
          <div className="bg-[#1e1922] border border-[#342c3a] rounded p-3">
            <div className="text-[11px] uppercase tracking-wider text-[#a89f91]">
              {isVictory ? 'Max Combo' : 'Slain'}
            </div>
            <div className="mt-1 font-mono-num text-lg font-bold text-[#f5efe6]">
              {isVictory ? `${hud.maxCombo}×` : hud.kills}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          {isPaused ? (
            <button
              type="button"
              onClick={onResume}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#d97706] hover:bg-[#b45309] text-[#0e0c0f] font-display font-bold rounded border border-[#fde68a]/50 whitespace-nowrap"
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#d97706] hover:bg-[#b45309] text-[#0e0c0f] font-display font-bold rounded border border-[#fde68a]/50 whitespace-nowrap"
            >
              Play Again
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              onClick={onRestart}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#26202b] hover:bg-[#332b3a] text-[#f5efe6] font-semibold rounded border border-[#453a4e] whitespace-nowrap"
            >
              Restart
            </button>
          )}

          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#1e1922] hover:bg-[#2a2330] text-[#cfc6b8] font-semibold rounded border border-[#382f40] whitespace-nowrap"
          >
            Title Roster
          </button>
        </div>
      </div>
    </div>
  );
}
