import { useCallback, useEffect, useRef, useState } from 'react';
import { GameModals } from './components/GameModals';
import { HudOverlay } from './components/HudOverlay';
import { TitleOverlay } from './components/TitleOverlay';
import { HERO_CLASSES } from './game/constants';
import { DungeonEngine } from './game/engine';
import { loadProgress, saveProgress, tryUnlockHero, tryUnlockPet } from './game/progress';
import type { HeroClassId, HudSnapshot, PersistentProgress, PetId } from './game/types';

function createInitialHud(progress: PersistentProgress): HudSnapshot {
  const hero = HERO_CLASSES[progress.selectedHero];
  return {
    gameState: 'title',
    heroClass: progress.selectedHero,
    petId: progress.selectedPet,
    weapon: hero.weapons[0],
    weaponLevel: 1,
    weaponUpgradeCost: 25,
    canUpgradeWeapon: false,
    level: 1,
    xp: 0,
    xpToNext: 60,
    hp: hero.maxHp,
    maxHp: hero.maxHp,
    ghostHp: hero.maxHp,
    buster: 35,
    maxBuster: 100,
    busterReady: false,
    dashReadyRatio: 1,
    floor: 1,
    maxFloors: 3,
    floorTheme: 'Stone Catacombs',
    enemiesRemaining: 0,
    totalEnemies: 0,
    portalOpen: false,
    score: 0,
    bestScore: progress.bestScore,
    runCoins: 0,
    bankCoins: progress.bankCoins,
    combo: 0,
    maxCombo: 0,
    kills: 0,
    elapsedSeconds: 0,
    bossName: null,
    bossHp: 0,
    bossMaxHp: 1,
    muted: false,
    bannerText: null,
  };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<DungeonEngine | null>(null);

  const [progress, setProgress] = useState<PersistentProgress>(() => loadProgress());
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const [hud, setHud] = useState<HudSnapshot>(() => createInitialHud(progress));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new DungeonEngine(
      canvas,
      (snap) => {
        setHud(snap);
      },
      ({ coinsEarned, score }) => {
        setProgress((prev) => {
          const next: PersistentProgress = {
            ...prev,
            bankCoins: prev.bankCoins + coinsEarned,
            bestScore: Math.max(prev.bestScore, score),
          };
          saveProgress(next);
          return next;
        });
      }
    );

    engineRef.current = engine;
    const p = progressRef.current;
    engine.syncPersistentData(p.bankCoins, p.bestScore, p.selectedHero, p.selectedPet);

    // Support ?autostart=1 for automated verification
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startNewRun(p.selectedHero, p.selectedPet);
    }

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Attach minimap canvas whenever HUD mounts/updates
  useEffect(() => {
    engineRef.current?.setMinimapCanvas(hud.gameState === 'playing' ? minimapRef.current : null);
  }, [hud.gameState]);

  // Sync persistent progress changes into engine
  useEffect(() => {
    engineRef.current?.syncPersistentData(
      progress.bankCoins,
      progress.bestScore,
      progress.selectedHero,
      progress.selectedPet
    );
  }, [progress]);

  const handleSelectOrUnlockHero = useCallback((heroId: HeroClassId) => {
    setProgress((prev) => {
      const next = tryUnlockHero(prev, heroId);
      if (!next) return prev;
      saveProgress(next);
      return next;
    });
  }, []);

  const handleSelectOrUnlockPet = useCallback((petId: PetId) => {
    setProgress((prev) => {
      const next = tryUnlockPet(prev, petId);
      if (!next) return prev;
      saveProgress(next);
      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const p = progressRef.current;
    engineRef.current?.startNewRun(p.selectedHero, p.selectedPet);
    canvasRef.current?.focus();
  }, []);

  const handleResume = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    engineRef.current?.resumeGame();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const handleRestart = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const p = progressRef.current;
    engineRef.current?.startNewRun(p.selectedHero, p.selectedPet);
  }, []);

  const handleReturnTitle = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleUpgradeWeapon = useCallback(() => {
    engineRef.current?.upgradeWeapon();
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0e0c0f]">
      {/* Isolated full-viewport game canvas */}
      <div className="fixed inset-0">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          data-testid="game-canvas"
          aria-label="Dungeon Rampage isometric dungeon playfield"
          className="block w-full h-full outline-none cursor-crosshair"
        />
      </div>

      {hud.gameState === 'title' && (
        <TitleOverlay
          progress={progress}
          onSelectOrUnlockHero={handleSelectOrUnlockHero}
          onSelectOrUnlockPet={handleSelectOrUnlockPet}
          onStart={handleStart}
        />
      )}

      {hud.gameState === 'playing' && (
        <HudOverlay
          hud={hud}
          minimapRef={minimapRef}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onRestart={handleRestart}
          onUpgradeWeapon={handleUpgradeWeapon}
        />
      )}

      <GameModals
        hud={hud}
        onResume={handleResume}
        onRestart={handleRestart}
        onReturnTitle={handleReturnTitle}
      />
    </main>
  );
}
