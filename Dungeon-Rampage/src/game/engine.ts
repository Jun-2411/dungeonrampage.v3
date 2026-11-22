import {
  FLOOR_PALETTES,
  HERO_CLASSES,
  MAX_ATTACK_TOKENS,
  MAX_FLOORS,
  MAX_PARTICLES,
  PET_CONFIGS,
  RARITY_COLORS,
  RARITY_LABELS,
  TILE_HALF_H,
  TILE_HALF_W,
  WALL_HEIGHT,
  PILLAR_HEIGHT,
} from './constants';
import { soundFx } from './audio';
import { generateDungeonFloor, isWalkableTile } from './dungeonGen';
import { angleDiff, clamp, computeComboDamage, computeKillScore, normalizeVec, screenToWorld, worldToIso } from './isoMath';
import type {
  DungeonFloorData,
  EnemyEntity,
  FloatingText,
  GameState,
  HazardZone,
  HeroClassId,
  HudSnapshot,
  Particle,
  PetEntity,
  PetId,
  PickupItem,
  Projectile,
  SlashArcEffect,
  WeaponDef,
} from './types';

interface RenderItem {
  depth: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

export class DungeonEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private minimapCanvas: HTMLCanvasElement | null = null;
  private onHudUpdate: (snap: HudSnapshot) => void;
  private onRunEnd: (result: { coinsEarned: number; score: number; victory: boolean }) => void;

  private rafId: number | null = null;
  private lastTime = 0;
  private hudTimer = 0;
  private minimapTimer = 0;
  private lastHudKey = '';
  private resizeObserver: ResizeObserver | null = null;
  private canvasBounds = { left: 0, top: 0, width: 1280, height: 720 };

  // State machine
  private gameState: GameState = 'title';
  private heroClassId: HeroClassId = 'berserker';
  private petId: PetId = 'wolf';
  private equippedWeapon: WeaponDef = HERO_CLASSES.berserker.weapons[0];
  private weaponLevel = 1;

  // Persistent bank snapshot (synced from React)
  private bankCoins = 0;
  private bestScore = 0;

  // Floor & world
  private runSeed = 1337;
  private floorData: DungeonFloorData;
  private currentFloor = 1;
  private totalEnemiesOnFloor = 0;

  // Camera & juice
  private camX = 0;
  private camY = 0;
  private titleTourTime = 0;
  private trauma = 0;
  private hitstop = 0;
  private worldTime = 0;

  // Hero runtime state
  private px = 10;
  private py = 10;
  private pvx = 0;
  private pvy = 0;
  private pFacing = 0.78;
  private hp = 145;
  private maxHp = 145;
  private ghostHp = 145;
  private level = 1;
  private xp = 0;
  private xpToNext = 60;
  private buster = 0;
  private maxBuster = 100;
  private attackCooldown = 0;
  private comboStep = 0;
  private comboResetTimer = 0;
  private dashTimer = 0;
  private dashCooldown = 0;
  private dashDirX = 1;
  private dashDirY = 0;
  private invulnTimer = 0;
  private playerHitFlash = 0;
  private playerSquashX = 1;
  private playerSquashY = 1;
  private playerGait = 0;
  private swingAnimTimer = 0;
  private spikeCooldown = 0;

  // Pet runtime
  private pet: PetEntity | null = null;

  // Run stats
  private score = 0;
  private runCoins = 0;
  private combo = 0;
  private maxCombo = 0;
  private comboDecayTimer = 0;
  private kills = 0;
  private elapsedSeconds = 0;
  private bannerText: string | null = null;
  private bannerTimer = 0;
  private defeatDelayTimer = 0;
  private pendingDefeat = false;

  // Dynamic entities
  private projectiles: Projectile[] = [];
  private pickups: PickupItem[] = [];
  private hazards: HazardZone[] = [];
  private floatingTexts: FloatingText[] = [];
  private slashEffects: SlashArcEffect[] = [];
  private particles: Particle[] = [];
  private particleCursor = 0;
  private nextEntityId = 1000;

  // Unified input hub
  private keysHeld = new Set<string>();
  private mouseDown = false;
  private mouseClientX = 0;
  private mouseClientY = 0;
  private pointerAimActive = false;
  private attackBuffer = 0;
  private dashBuffer = 0;
  private busterBuffer = 0;

  constructor(
    canvas: HTMLCanvasElement,
    onHudUpdate: (snap: HudSnapshot) => void,
    onRunEnd: (result: { coinsEarned: number; score: number; victory: boolean }) => void
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not acquire 2D context for Dungeon Rampage');
    }
    this.ctx = ctx;
    this.onHudUpdate = onHudUpdate;
    this.onRunEnd = onRunEnd;

    // Pre-allocate zero-GC particle ring buffer
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 3,
        life: 0,
        maxLife: 0.4,
        color: '#fbbf24',
        gravity: 16,
      });
    }

    this.floorData = generateDungeonFloor(1, this.runSeed);
    this.buildTorchGlowSprite(1);
    this.resetHeroToFloorSpawn();
    this.initTitleCamera();
    this.bindEvents();
    this.syncBodyState();
    this.emitHud(true);
    this.startLoop();
  }

  private torchGlowCanvas: HTMLCanvasElement | null = null;

  private buildTorchGlowSprite(floor: number): void {
    if (typeof document === 'undefined') return;
    const c = document.createElement('canvas');
    c.width = 180;
    c.height = 180;
    const gctx = c.getContext('2d');
    if (!gctx) return;
    const palette = FLOOR_PALETTES[floor] ?? FLOOR_PALETTES[1];
    const grad = gctx.createRadialGradient(90, 90, 6, 90, 90, 90);
    grad.addColorStop(0, palette.ambientGlow.replace(/[\d.]+\)$/, '0.32)'));
    grad.addColorStop(0.45, palette.ambientGlow.replace(/[\d.]+\)$/, '0.14)'));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 180, 180);
    this.torchGlowCanvas = c;
  }

  public setMinimapCanvas(canvas: HTMLCanvasElement | null): void {
    this.minimapCanvas = canvas;
  }

  public syncPersistentData(bankCoins: number, bestScore: number, heroId: HeroClassId, petId: PetId): void {
    this.bankCoins = bankCoins;
    this.bestScore = bestScore;
    if (this.gameState === 'title') {
      this.heroClassId = heroId;
      this.petId = petId;
      this.equippedWeapon = HERO_CLASSES[heroId].weapons[0];
      this.maxHp = HERO_CLASSES[heroId].maxHp;
      this.hp = this.maxHp;
      this.ghostHp = this.maxHp;
    }
    this.emitHud(true);
  }

  public getGameState(): GameState {
    return this.gameState;
  }

  public toggleMute(): void {
    soundFx.toggleMute();
    this.emitHud(true);
  }

  public startNewRun(heroId?: HeroClassId, petId?: PetId): void {
    if (heroId) this.heroClassId = heroId;
    if (petId) this.petId = petId;

    const cfg = HERO_CLASSES[this.heroClassId];
    this.equippedWeapon = cfg.weapons[0];
    this.weaponLevel = 1;
    this.runSeed = Math.floor(Date.now() % 1000000) + Math.floor(Math.random() * 9999);
    this.currentFloor = 1;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = 60;
    this.maxHp = cfg.maxHp;
    this.hp = cfg.maxHp;
    this.ghostHp = cfg.maxHp;
    this.buster = 35; // small starter charge so players feel progress quickly
    this.score = 0;
    this.runCoins = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.kills = 0;
    this.elapsedSeconds = 0;
    this.pendingDefeat = false;
    this.defeatDelayTimer = 0;
    this.hitstop = 0;
    this.trauma = 0;

    this.floorData = generateDungeonFloor(1, this.runSeed);
    this.buildTorchGlowSprite(1);
    this.resetHeroToFloorSpawn();
    this.spawnPetNearHero();
    this.setBanner(`Floor 1 · ${this.floorData.themeName}`, 2.4);

    this.clearInputs();
    this.gameState = 'playing';
    this.syncBodyState();
    this.emitHud(true);
  }

  public getWeaponUpgradeCost(): number {
    return 25 + (this.weaponLevel - 1) * 20;
  }

  public upgradeWeapon(): boolean {
    if (this.weaponLevel >= 10) return false;
    const cost = this.getWeaponUpgradeCost();
    if (this.runCoins < cost) {
      this.floatingTexts.push({
        x: this.px,
        y: this.py - 0.5,
        z: 28,
        vz: 18,
        text: 'NEED MORE COINS!',
        color: '#ef4444',
        life: 0.9,
        maxLife: 0.9,
        scale: 1,
      });
      return false;
    }
    this.runCoins -= cost;
    this.weaponLevel += 1;
    soundFx.playWeaponUpgrade();
    this.setBanner(`⚡ FORGE UPGRADED: ${this.equippedWeapon.name} +${this.weaponLevel}!`, 2.4);

    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const spd = 2.5 + Math.random() * 2.5;
      this.spawnParticle(
        this.px,
        this.py,
        18,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        28,
        4,
        0.65,
        i % 2 === 0 ? '#fbbf24' : '#60a5fa',
        24
      );
    }

    this.floatingTexts.push({
      x: this.px,
      y: this.py - 0.6,
      z: 32,
      vz: 26,
      text: `+${this.weaponLevel} FORGED!`,
      color: '#fbbf24',
      life: 1.3,
      maxLife: 1.3,
      scale: 1.3,
    });

    this.emitHud(true);
    return true;
  }

  public pauseGame(): void {
    if (this.gameState !== 'playing') return;
    this.clearInputs();
    this.gameState = 'paused';
    this.syncBodyState();
    this.emitHud(true);
  }

  public resumeGame(): void {
    if (this.gameState !== 'paused') return;
    this.clearInputs();
    this.gameState = 'playing';
    this.syncBodyState();
    this.emitHud(true);
  }

  public returnToTitle(): void {
    this.clearInputs();
    this.gameState = 'title';
    this.floorData = generateDungeonFloor(1, 1337);
    this.buildTorchGlowSprite(1);
    this.resetHeroToFloorSpawn();
    this.initTitleCamera();
    this.syncBodyState();
    this.emitHud(true);
  }

  public triggerPauseToggle(): void {
    if (this.gameState === 'playing') {
      this.pauseGame();
    } else if (this.gameState === 'paused') {
      this.resumeGame();
    }
  }

  public destroy(): void {
    if (this.paceTimeoutId !== null) {
      clearTimeout(this.paceTimeoutId);
      this.paceTimeoutId = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.resizeObserver?.disconnect();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }

  private syncBodyState(): void {
    if (typeof document === 'undefined') return;
    // Mirror state machine to document.body.dataset.state ('title' | 'playing' | 'paused' | 'gameover')
    const mapped = this.gameState === 'victory' ? 'gameover' : this.gameState;
    document.body.dataset.state = mapped;
  }

  private clearInputs(): void {
    this.keysHeld.clear();
    this.mouseDown = false;
    this.attackBuffer = 0;
    this.dashBuffer = 0;
    this.busterBuffer = 0;
  }

  private bindEvents(): void {
    const updateBounds = () => {
      const rect = this.canvas.getBoundingClientRect();
      this.canvasBounds = {
        left: rect.left,
        top: rect.top,
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.floor(this.canvasBounds.width * dpr);
      const targetH = Math.floor(this.canvasBounds.height * dpr);
      if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
        this.canvas.width = targetW;
        this.canvas.height = targetH;
      }
    };

    updateBounds();
    this.resizeObserver = new ResizeObserver(updateBounds);
    this.resizeObserver.observe(this.canvas);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private handleWindowBlur = () => {
    this.clearInputs();
  };

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.clearInputs();
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    this.mouseClientX = e.clientX;
    this.mouseClientY = e.clientY;
    this.pointerAimActive = true;
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (this.gameState !== 'playing') return;
    this.mouseClientX = e.clientX;
    this.mouseClientY = e.clientY;
    this.pointerAimActive = true;
    if (e.button === 0) {
      this.mouseDown = true;
      this.attackBuffer = 0.14;
    } else if (e.button === 2) {
      this.busterBuffer = 0.14;
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouseDown = false;
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    const code = e.code;

    if (code === 'KeyM' && !e.repeat) {
      this.toggleMute();
      return;
    }

    if ((code === 'Escape' || code === 'KeyP') && !e.repeat) {
      if (this.gameState === 'playing' || this.gameState === 'paused') {
        this.triggerPauseToggle();
        return;
      }
    }

    if (code === 'KeyR' && !e.repeat && (this.gameState === 'paused' || this.gameState === 'gameover' || this.gameState === 'victory')) {
      this.startNewRun();
      return;
    }

    if (this.gameState !== 'playing') return;

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      e.preventDefault();
    }

    const wasHeld = this.keysHeld.has(code);
    this.keysHeld.add(code);

    if (!wasHeld) {
      if (code === 'KeyJ') {
        this.pointerAimActive = false;
        this.attackBuffer = 0.14;
      } else if (code === 'Space' || code === 'ShiftLeft') {
        this.dashBuffer = 0.14;
      } else if (code === 'KeyK' || code === 'KeyE') {
        this.busterBuffer = 0.14;
      } else if (code === 'KeyU') {
        this.upgradeWeapon();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keysHeld.delete(e.code);
  };

  private initTitleCamera(): void {
    const center = worldToIso(this.floorData.spawnX + 4, this.floorData.spawnY + 4);
    this.camX = center.x;
    this.camY = center.y;
  }

  private resetHeroToFloorSpawn(): void {
    this.px = this.floorData.spawnX;
    this.py = this.floorData.spawnY;
    this.pvx = 0;
    this.pvy = 0;
    this.pFacing = Math.PI * 0.25;
    this.invulnTimer = 0.8;
    this.dashTimer = 0;
    this.attackCooldown = 0;
    this.comboStep = 0;
    this.projectiles = [];
    this.pickups = [];
    this.hazards = [];
    this.floatingTexts = [];
    this.slashEffects = [];
    this.totalEnemiesOnFloor = this.floorData.enemies.length;
    this.revealFogAround(this.px, this.py, 7);

    const iso = worldToIso(this.px, this.py);
    this.camX = iso.x;
    this.camY = iso.y;
  }

  private spawnPetNearHero(): void {
    if (this.petId === 'none') {
      this.pet = null;
      return;
    }
    this.pet = {
      id: this.petId,
      x: this.px - 0.85,
      y: this.py + 0.65,
      vx: 0,
      vy: 0,
      facing: this.pFacing,
      attackCooldown: 0.4,
      gaitDist: 0,
      squashX: 1,
      squashY: 1,
      lungeTimer: 0,
    };
  }

  private setBanner(text: string, duration = 2.2): void {
    this.bannerText = text;
    this.bannerTimer = duration;
    this.emitHud(true);
  }

  private lastRenderedState: GameState = 'title';
  private paceTimeoutId: number | null = null;

  private startLoop(): void {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const frameStart = performance.now();
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.0001), 0.05);

      this.update(dt);
      const isStaticModal =
        (this.gameState === 'paused' || this.gameState === 'victory' || this.gameState === 'gameover') &&
        this.trauma <= 0.001 &&
        this.lastRenderedState === this.gameState;

      if (!isStaticModal) {
        this.render();
        this.lastRenderedState = this.gameState;
      }

      const elapsed = performance.now() - frameStart;
      if (elapsed > 8) {
        // Yield briefly on software-rasterized devices so browser UI/IPC never starves
        this.paceTimeoutId = window.setTimeout(() => {
          this.rafId = requestAnimationFrame(tick);
        }, 12);
      } else {
        this.rafId = requestAnimationFrame(tick);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private update(dt: number): void {
    this.worldTime += dt;

    if (this.gameState === 'title') {
      this.titleTourTime += dt;
      // Smooth live-world isometric tour over the dungeon courtyard & chambers
      const tourX = this.floorData.spawnX + 6 + Math.cos(this.titleTourTime * 0.22) * 5.5;
      const tourY = this.floorData.spawnY + 5 + Math.sin(this.titleTourTime * 0.17) * 4.5;
      const iso = worldToIso(tourX, tourY);
      this.camX += (iso.x - this.camX) * Math.min(1, dt * 2.5);
      this.camY += (iso.y - this.camY) * Math.min(1, dt * 2.5);

      // Ambient drifting dungeon embers
      if (Math.random() < dt * 12) {
        const torch = this.floorData.torches[Math.floor(Math.random() * this.floorData.torches.length)];
        if (torch) {
          this.spawnParticle(
            torch.x + (Math.random() - 0.5) * 0.3,
            torch.y + (Math.random() - 0.5) * 0.3,
            24,
            (Math.random() - 0.5) * 0.4,
            (Math.random() - 0.5) * 0.4,
            18 + Math.random() * 14,
            2.4,
            0.75,
            '#fbbf24',
            -4
          );
        }
      }
      this.updateParticles(dt);
      return;
    }

    if (this.gameState === 'paused' || this.gameState === 'victory' || this.gameState === 'gameover') {
      // Keep camera trauma decaying smoothly, freeze simulation
      this.trauma = Math.max(0, this.trauma - dt * 2.4);
      return;
    }

    // Playing state
    this.trauma = Math.max(0, this.trauma - dt * 2.2);
    this.playerHitFlash = Math.max(0, this.playerHitFlash - dt);
    this.ghostHp += (this.hp - this.ghostHp) * Math.min(1, dt * 4.5);

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerText = null;
        this.emitHud(true);
      }
    }

    // Particles & floating text tick even during hitstop so combat bursts feel razor-sharp
    this.updateParticles(dt);
    this.updateFloatingTexts(dt);
    this.updateSlashArcs(dt);

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    if (this.pendingDefeat) {
      this.defeatDelayTimer -= dt;
      if (this.defeatDelayTimer <= 0) {
        this.finishRun(false);
      }
      return;
    }

    this.elapsedSeconds += dt;
    this.updatePlayer(dt);
    this.updatePet(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    this.updatePickups(dt);
    this.updateFloorProgress();

    // Smooth camera follow
    const targetIso = worldToIso(this.px, this.py);
    this.camX += (targetIso.x - this.camX) * Math.min(1, dt * 9.5);
    this.camY += (targetIso.y - this.camY) * Math.min(1, dt * 9.5);

    // Ambient torch embers near player
    if (Math.random() < dt * 16) {
      for (const torch of this.floorData.torches) {
        if (Math.abs(torch.x - this.px) < 10 && Math.abs(torch.y - this.py) < 10 && Math.random() < 0.25) {
          this.spawnParticle(
            torch.x,
            torch.y,
            26,
            (Math.random() - 0.5) * 0.4,
            (Math.random() - 0.5) * 0.4,
            16 + Math.random() * 14,
            2.2,
            0.55,
            '#fb923c',
            -3
          );
        }
      }
    }

    this.minimapTimer = Math.max(0, this.minimapTimer - dt);
    this.hudTimer += dt;
    if (this.hudTimer >= 0.08) {
      this.hudTimer = 0;
      this.emitHud(false);
    }
  }

  private updatePlayer(dt: number): void {
    const cfg = HERO_CLASSES[this.heroClassId];

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.swingAnimTimer = Math.max(0, this.swingAnimTimer - dt);
    this.spikeCooldown = Math.max(0, this.spikeCooldown - dt);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.dashBuffer = Math.max(0, this.dashBuffer - dt);
    this.busterBuffer = Math.max(0, this.busterBuffer - dt);

    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) this.comboStep = 0;
    }

    if (this.combo > 0) {
      this.comboDecayTimer -= dt;
      if (this.comboDecayTimer <= 0) {
        this.combo = 0;
      }
    }

    // Damping squash & stretch back to (1,1)
    this.playerSquashX += (1 - this.playerSquashX) * Math.min(1, dt * 14);
    this.playerSquashY += (1 - this.playerSquashY) * Math.min(1, dt * 14);

    // Screen-aligned WASD / Arrow movement converted to isometric world space
    let sx = 0;
    let sy = 0;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) sx -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) sx += 1;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) sy -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) sy += 1;

    const moveWorld = normalizeVec(sx + sy, sy - sx);

    if (this.pointerAimActive) {
      const worldAim = screenToWorld(
        this.mouseClientX,
        this.mouseClientY,
        this.canvasBounds,
        this.camX,
        this.camY
      );
      if (Math.hypot(worldAim.x - this.px, worldAim.y - this.py) > 0.08) {
        this.pFacing = Math.atan2(worldAim.y - this.py, worldAim.x - this.px);
      }
    } else if (Math.hypot(moveWorld.x, moveWorld.y) > 0.1) {
      this.pFacing = Math.atan2(moveWorld.y, moveWorld.x);
    }

    // Dash execution (buffered)
    if (this.dashBuffer > 0 && this.dashCooldown <= 0 && this.dashTimer <= 0) {
      this.dashBuffer = 0;
      this.dashTimer = 0.17;
      this.dashCooldown = cfg.dashCooldown;
      this.invulnTimer = Math.max(this.invulnTimer, 0.22);
      if (Math.hypot(moveWorld.x, moveWorld.y) > 0.1) {
        this.dashDirX = moveWorld.x;
        this.dashDirY = moveWorld.y;
      } else {
        this.dashDirX = Math.cos(this.pFacing);
        this.dashDirY = Math.sin(this.pFacing);
      }
      this.playerSquashX = 1.24;
      this.playerSquashY = 0.78;
      soundFx.playDash();
      for (let i = 0; i < 8; i++) {
        this.spawnParticle(
          this.px,
          this.py,
          4,
          (Math.random() - 0.5) * 1.8,
          (Math.random() - 0.5) * 1.8,
          10 + Math.random() * 8,
          3.2,
          0.3,
          cfg.accentColor,
          18
        );
      }
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      const dashSpeed = cfg.speed * 2.9;
      this.pvx = this.dashDirX * dashSpeed;
      this.pvy = this.dashDirY * dashSpeed;
      if (Math.random() < 0.75) {
        this.spawnParticle(this.px, this.py, 5, 0, 0, 4, 3.0, 0.2, cfg.primaryColor, 0);
      }
    } else {
      const targetVx = moveWorld.x * cfg.speed;
      const targetVy = moveWorld.y * cfg.speed;
      const accel = Math.hypot(moveWorld.x, moveWorld.y) > 0.1 ? 18 : 16;
      this.pvx += (targetVx - this.pvx) * Math.min(1, dt * accel);
      this.pvy += (targetVy - this.pvy) * Math.min(1, dt * accel);
    }

    const prevX = this.px;
    const prevY = this.py;
    const pPos = { x: this.px, y: this.py };
    this.moveCircleInDungeon(pPos, 0.34, this.pvx * dt, this.pvy * dt);
    this.px = pPos.x;
    this.py = pPos.y;
    const stepDist = Math.hypot(this.px - prevX, this.py - prevY);
    this.playerGait += stepDist * 4.5;

    if (stepDist > 0.02 && Math.random() < dt * 10 && this.dashTimer <= 0) {
      this.spawnParticle(this.px, this.py, 1, -this.pvx * 0.15, -this.pvy * 0.15, 6, 2.1, 0.26, '#94a3b8', 12);
    }

    this.revealFogAround(this.px, this.py, 6);

    // Check spikes tile hazard
    const tileUnder = this.getTileAt(Math.floor(this.px), Math.floor(this.py));
    if (tileUnder === 'spikes' && this.spikeCooldown <= 0 && this.dashTimer <= 0) {
      this.spikeCooldown = 0.75;
      this.damagePlayer(10, this.px, this.py);
    }

    // Check chest auto-open on close walk-up
    for (const prop of this.floorData.props) {
      if (prop.kind === 'chest' && !prop.opened && Math.hypot(prop.x - this.px, prop.y - this.py) < 1.15) {
        this.openChest(prop);
      }
    }

    // Dungeon Buster Special!
    if (this.busterBuffer > 0 && this.buster >= this.maxBuster) {
      this.busterBuffer = 0;
      this.triggerDungeonBuster();
    }

    // Held attack or buffered attack
    const wantsAttack = this.mouseDown || this.keysHeld.has('KeyJ') || this.attackBuffer > 0;
    if (wantsAttack && this.attackCooldown <= 0 && this.dashTimer <= 0) {
      this.attackBuffer = 0;
      this.performPrimaryAttack();
    }
  }

  private performPrimaryAttack(): void {
    const cfg = HERO_CLASSES[this.heroClassId];
    const weapon = this.equippedWeapon;
    const levelBonus = (this.level - 1) * 4;
    const weaponScale = 1 + (this.weaponLevel - 1) * 0.35;
    const baseDmg = Math.round((cfg.attackDamage + weapon.damageBonus + levelBonus) * weaponScale);
    const cd = cfg.attackCooldown / weapon.speedMult;

    this.attackCooldown = cd;
    this.swingAnimTimer = 0.2;
    this.comboResetTimer = 0.85;
    const step = this.comboStep;
    this.comboStep = (this.comboStep + 1) % 3;

    // Slight forward lunge on attack
    this.pvx += Math.cos(this.pFacing) * (cfg.isRanged ? 0.8 : 2.8);
    this.pvy += Math.sin(this.pFacing) * (cfg.isRanged ? 0.8 : 2.8);
    this.playerSquashX = 1.16;
    this.playerSquashY = 0.86;

    if (!cfg.isRanged) {
      // Melee cleave (Berserker, Battle, Chef Ghost Samurai)
      const range = cfg.attackRange + weapon.rangeBonus + (this.weaponLevel - 1) * 0.08 + (step === 2 ? 0.45 : 0);
      const arc = cfg.attackArc + (this.weaponLevel - 1) * 0.04 + (step === 2 ? 0.35 : 0);
      soundFx.playSwing(step === 2);

      this.slashEffects.push({
        x: this.px,
        y: this.py,
        angle: this.pFacing,
        arc,
        radius: range,
        life: 0.16,
        maxLife: 0.16,
        color: step === 2 ? weapon.color : cfg.accentColor,
        comboStep: step,
      });

      let hitAnything = false;
      for (const enemy of this.floorData.enemies) {
        if (enemy.state === 'dying') continue;
        const dx = enemy.x - this.px;
        const dy = enemy.y - this.py;
        const dist = Math.hypot(dx, dy);
        if (dist <= range + enemy.radius) {
          const ang = Math.atan2(dy, dx);
          if (Math.abs(angleDiff(ang, this.pFacing)) <= arc * 0.55 || dist < 0.85) {
            const kb = (step === 2 ? 8.2 : 4.6) + (this.weaponLevel - 1) * 0.25;
            const dmg = computeComboDamage(baseDmg, this.combo, step, false);
            this.damageEnemy(enemy, dmg, Math.cos(ang) * kb, Math.sin(ang) * kb, step === 2);
            hitAnything = true;
          }
        }
      }

      // Hit destructibles
      for (const prop of this.floorData.props) {
        if (prop.hp <= 0) continue;
        const dx = prop.x - this.px;
        const dy = prop.y - this.py;
        const dist = Math.hypot(dx, dy);
        if (dist <= range + 0.5) {
          const ang = Math.atan2(dy, dx);
          if (Math.abs(angleDiff(ang, this.pFacing)) <= arc * 0.6 || dist < 1.0) {
            this.damageProp(prop, baseDmg);
          }
        }
      }

      if (hitAnything && step === 2) {
        this.hitstop = Math.max(this.hitstop, 0.045);
        this.trauma = Math.min(1, this.trauma + 0.35);
      }
    } else {
      // Ranged volley (Ranger, Sorcerer, Vampire Hunter)
      const projKind =
        this.heroClassId === 'sorcerer'
          ? 'arcane'
          : this.heroClassId === 'vampire_hunter'
            ? 'stake'
            : 'arrow';
      soundFx.playRangedShot(projKind);

      const extraProj = Math.min(4, Math.floor((this.weaponLevel - 1) / 2));
      const count = (step === 2 ? 3 : 1) + extraProj;
      const spread = 0.16 + extraProj * 0.025;
      const speed = projKind === 'stake' ? 14.5 : projKind === 'arrow' ? 13.5 : 11.2;
      const dmg = computeComboDamage(baseDmg, this.combo, step, false);
      const pierce = (this.heroClassId === 'ranger' && step === 2 ? 2 : 1) + Math.floor(this.weaponLevel / 4);

      for (let i = 0; i < count; i++) {
        const offsetAngle = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
        const ang = this.pFacing + offsetAngle;
        this.projectiles.push({
          id: this.nextEntityId++,
          fromPlayer: true,
          kind: projKind,
          x: this.px + Math.cos(ang) * 0.35,
          y: this.py + Math.sin(ang) * 0.35,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          radius: step === 2 && projKind === 'arcane' ? 0.34 : 0.22,
          damage: dmg,
          life: (cfg.attackRange + weapon.rangeBonus) / speed,
          pierce,
          hitIds: [],
          color: step === 2 ? weapon.color : cfg.accentColor,
        });
      }
    }
  }

  private triggerDungeonBuster(): void {
    const cfg = HERO_CLASSES[this.heroClassId];
    this.buster = 0;
    this.invulnTimer = Math.max(this.invulnTimer, 0.75);
    this.hitstop = 0.055;
    this.trauma = 0.7;
    soundFx.playBuster();

    this.floatingTexts.push({
      x: this.px,
      y: this.py,
      z: 46,
      vz: 24,
      text: `${cfg.busterName.toUpperCase()}!`,
      color: '#fbbf24',
      life: 1.15,
      maxLife: 1.15,
      scale: 1.25,
    });

    const busterWeaponMult = 1 + (this.weaponLevel - 1) * 0.3;
    const busterDmg = Math.round(
      (cfg.attackDamage + this.equippedWeapon.damageBonus + (this.level - 1) * 5) * 2.5 * busterWeaponMult
    );

    if (this.heroClassId === 'berserker' || this.heroClassId === 'battle' || this.heroClassId === 'chef_samurai') {
      // 360° Buster Cleave / Quake / Phantom Feast
      const radius = 3.8;
      this.slashEffects.push({
        x: this.px,
        y: this.py,
        angle: this.pFacing,
        arc: Math.PI * 2,
        radius,
        life: 0.34,
        maxLife: 0.34,
        color: cfg.primaryColor,
        comboStep: 2,
      });

      for (const enemy of this.floorData.enemies) {
        if (enemy.state === 'dying') continue;
        const dx = enemy.x - this.px;
        const dy = enemy.y - this.py;
        const dist = Math.hypot(dx, dy);
        if (dist <= radius + enemy.radius) {
          const ang = Math.atan2(dy, dx);
          this.damageEnemy(enemy, busterDmg, Math.cos(ang) * 9.5, Math.sin(ang) * 9.5, true);
          if (this.heroClassId === 'battle') {
            enemy.state = 'stunned';
            enemy.stateTimer = 1.4;
          }
        }
      }
      for (const prop of this.floorData.props) {
        if (prop.hp > 0 && Math.hypot(prop.x - this.px, prop.y - this.py) <= radius) {
          this.damageProp(prop, busterDmg);
        }
      }
      if (this.heroClassId === 'chef_samurai') {
        // Phantom Feast also heals and drops food!
        this.hp = Math.min(this.maxHp, this.hp + 28);
        this.spawnPickup('food', this.px + 0.6, this.py, 20);
      }
    } else if (this.heroClassId === 'ranger' || this.heroClassId === 'vampire_hunter') {
      // 12-projectile piercing fan / radial barrage
      const count = 12;
      for (let i = 0; i < count; i++) {
        const ang = this.pFacing + ((i / count) - 0.5) * Math.PI * 1.1;
        this.projectiles.push({
          id: this.nextEntityId++,
          fromPlayer: true,
          kind: this.heroClassId === 'vampire_hunter' ? 'stake' : 'arrow',
          x: this.px,
          y: this.py,
          vx: Math.cos(ang) * 15,
          vy: Math.sin(ang) * 15,
          radius: 0.28,
          damage: Math.round(busterDmg * 0.72),
          life: 0.85,
          pierce: 3,
          hitIds: [],
          color: '#fbbf24',
        });
      }
    } else {
      // Sorcerer Meteor Nova: 5 explosive impact blasts around target direction
      for (let i = 0; i < 5; i++) {
        const ang = this.pFacing + (i - 2) * 0.42;
        const dist = 2.4 + (i % 2) * 1.1;
        const mx = this.px + Math.cos(ang) * dist;
        const my = this.py + Math.sin(ang) * dist;
        this.slashEffects.push({
          x: mx,
          y: my,
          angle: 0,
          arc: Math.PI * 2,
          radius: 1.9,
          life: 0.36,
          maxLife: 0.36,
          color: '#f59e0b',
          comboStep: 2,
        });
        for (const enemy of this.floorData.enemies) {
          if (enemy.state !== 'dying' && Math.hypot(enemy.x - mx, enemy.y - my) <= 2.1 + enemy.radius) {
            const kAng = Math.atan2(enemy.y - mx, enemy.x - mx);
            this.damageEnemy(enemy, Math.round(busterDmg * 0.9), Math.cos(kAng) * 7, Math.sin(kAng) * 7, true);
          }
        }
        for (let p = 0; p < 12; p++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 1.5 + Math.random() * 3.5;
          this.spawnParticle(mx, my, 10, Math.cos(a) * sp, Math.sin(a) * sp, 22, 4, 0.45, '#f97316', 18);
        }
      }
    }

    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this.spawnParticle(this.px, this.py, 10, Math.cos(a) * 4.5, Math.sin(a) * 4.5, 18, 4.2, 0.45, cfg.accentColor, 12);
    }
    this.emitHud(true);
  }

  private updatePet(dt: number): void {
    if (!this.pet) return;
    const cfg = PET_CONFIGS[this.pet.id];
    this.pet.attackCooldown = Math.max(0, this.pet.attackCooldown - dt);
    this.pet.lungeTimer = Math.max(0, this.pet.lungeTimer - dt);
    this.pet.squashX += (1 - this.pet.squashX) * Math.min(1, dt * 12);
    this.pet.squashY += (1 - this.pet.squashY) * Math.min(1, dt * 12);

    // Find nearest living enemy within 7 tiles of hero
    let target: EnemyEntity | null = null;
    let bestDist = 7.5;
    for (const enemy of this.floorData.enemies) {
      if (enemy.state === 'dying') continue;
      const d = Math.hypot(enemy.x - this.px, enemy.y - this.py);
      if (d < bestDist) {
        bestDist = d;
        target = enemy;
      }
    }

    const prevX = this.pet.x;
    const prevY = this.pet.y;

    if (target) {
      const dx = target.x - this.pet.x;
      const dy = target.y - this.pet.y;
      const dist = Math.hypot(dx, dy);
      this.pet.facing = Math.atan2(dy, dx);

      if (cfg.isRanged) {
        // Dragon hovers at mid-range and shoots fireballs
        if (dist > 3.8) {
          const n = normalizeVec(dx, dy);
          this.pet.vx = n.x * cfg.speed;
          this.pet.vy = n.y * cfg.speed;
        } else if (dist < 2.1) {
          const n = normalizeVec(-dx, -dy);
          this.pet.vx = n.x * cfg.speed * 0.7;
          this.pet.vy = n.y * cfg.speed * 0.7;
        } else {
          this.pet.vx *= 0.85;
          this.pet.vy *= 0.85;
        }

        if (this.pet.attackCooldown <= 0 && dist < 6.5) {
          this.pet.attackCooldown = cfg.attackCooldown;
          this.pet.squashX = 1.2;
          this.pet.squashY = 0.85;
          const ang = Math.atan2(dy, dx);
          soundFx.playRangedShot('fireball');
          this.projectiles.push({
            id: this.nextEntityId++,
            fromPlayer: true,
            kind: 'fireball',
            x: this.pet.x,
            y: this.pet.y,
            vx: Math.cos(ang) * 10.5,
            vy: Math.sin(ang) * 10.5,
            radius: 0.26,
            damage: cfg.damage + (this.level - 1) * 2,
            life: 0.75,
            pierce: 1,
            hitIds: [],
            color: '#f97316',
          });
        }
      } else {
        // Wolf / Rhino melee companion
        if (dist > target.radius + 0.65) {
          const n = normalizeVec(dx, dy);
          const mult = this.pet.lungeTimer > 0 ? 1.8 : 1.0;
          this.pet.vx = n.x * cfg.speed * mult;
          this.pet.vy = n.y * cfg.speed * mult;
        } else {
          this.pet.vx *= 0.7;
          this.pet.vy *= 0.7;
          if (this.pet.attackCooldown <= 0) {
            this.pet.attackCooldown = cfg.attackCooldown;
            this.pet.lungeTimer = 0.16;
            this.pet.squashX = 1.25;
            this.pet.squashY = 0.8;
            const ang = Math.atan2(dy, dx);
            this.damageEnemy(
              target,
              cfg.damage + (this.level - 1) * 2,
              Math.cos(ang) * cfg.knockback,
              Math.sin(ang) * cfg.knockback,
              this.pet.id === 'rhino'
            );
          }
        }
      }
    } else {
      // Follow hero smoothly
      const followX = this.px - Math.cos(this.pFacing) * 0.95;
      const followY = this.py - Math.sin(this.pFacing) * 0.95;
      const dx = followX - this.pet.x;
      const dy = followY - this.pet.y;
      const d = Math.hypot(dx, dy);
      if (d > 4.5) {
        // Snap gently if far behind
        this.pet.x = followX;
        this.pet.y = followY;
      } else if (d > 0.35) {
        const n = normalizeVec(dx, dy);
        this.pet.vx = n.x * cfg.speed;
        this.pet.vy = n.y * cfg.speed;
        this.pet.facing = Math.atan2(dy, dx);
      } else {
        this.pet.vx *= 0.8;
        this.pet.vy *= 0.8;
      }
    }

    this.moveCircleInDungeon(this.pet, 0.25, this.pet.vx * dt, this.pet.vy * dt);
    this.pet.gaitDist += Math.hypot(this.pet.x - prevX, this.pet.y - prevY) * 5;
  }

  private updateEnemies(dt: number): void {
    // Count current attack tokens
    let activeTokens = 0;
    for (const e of this.floorData.enemies) {
      if (e.hasToken && e.state !== 'dying') activeTokens++;
    }

    for (const e of this.floorData.enemies) {
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      e.squashX += (1 - e.squashX) * Math.min(1, dt * 12);
      e.squashY += (1 - e.squashY) * Math.min(1, dt * 12);

      if (e.state === 'dying') {
        e.deathTimer -= dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vx *= 0.88;
        e.vy *= 0.88;
        continue;
      }

      if (e.state === 'stunned') {
        e.hasToken = false;
        e.stateTimer -= dt;
        e.vx *= 0.88;
        e.vy *= 0.88;
        this.moveCircleInDungeon(e, e.radius, e.vx * dt, e.vy * dt);
        if (e.stateTimer <= 0) {
          e.state = e.kind === 'goblin' || e.kind === 'cultist' ? 'kite' : 'chase';
        }
        continue;
      }

      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const dist = Math.hypot(dx, dy);

      // Sleep if far away in undiscovered room
      const aggroRange = e.kind === 'boss' ? 11.5 : 8.5;
      if (dist > aggroRange && e.hp === e.maxHp) {
        e.hasToken = false;
        continue;
      }

      const prevX = e.x;
      const prevY = e.y;

      if (e.state === 'windup') {
        e.stateTimer -= dt;
        e.vx *= 0.8;
        e.vy *= 0.8;
        if (e.kind !== 'orc' && e.kind !== 'cultist') {
          e.aimAngle = Math.atan2(dy, dx);
          e.facing = e.aimAngle;
        }
        if (e.stateTimer <= 0) {
          this.executeEnemyAttack(e);
        }
      } else if (e.state === 'attack') {
        e.stateTimer -= dt;
        if (e.kind === 'orc') {
          // Orc bull rush charge
          const prevEx = e.x;
          const prevEy = e.y;
          this.moveCircleInDungeon(e, e.radius, e.vx * dt, e.vy * dt);
          if (Math.hypot(e.x - prevEx, e.y - prevEy) < 0.02 && Math.hypot(e.vx, e.vy) > 1) {
            // Wall slam stun!
            e.state = 'stunned';
            e.stateTimer = 1.0;
            e.hasToken = false;
            this.trauma = Math.min(1, this.trauma + 0.25);
            this.floatingTexts.push({
              x: e.x,
              y: e.y,
              z: 30,
              vz: 18,
              text: 'STUNNED!',
              color: '#fde047',
              life: 0.7,
              maxLife: 0.7,
              scale: 0.95,
            });
            continue;
          }
          if (Math.hypot(this.px - e.x, this.py - e.y) < e.radius + 0.45) {
            this.damagePlayer(e.damage, e.x, e.y);
            e.state = 'recover';
            e.stateTimer = 0.55;
            e.hasToken = false;
          }
        }
        if (e.stateTimer <= 0) {
          e.state = 'recover';
          e.stateTimer = e.kind === 'boss' ? 0.55 : 0.42;
          e.hasToken = false;
        }
      } else if (e.state === 'recover') {
        e.stateTimer -= dt;
        e.vx *= 0.84;
        e.vy *= 0.84;
        this.moveCircleInDungeon(e, e.radius, e.vx * dt, e.vy * dt);
        if (e.stateTimer <= 0) {
          e.state = e.kind === 'goblin' || e.kind === 'cultist' ? 'kite' : 'chase';
          e.attackCooldown = e.kind === 'boss' ? 0.85 : 0.7 + Math.random() * 0.45;
        }
      } else {
        // Movement decision policies (4 distinct archetypes + Lord Dinglepus boss)
        e.facing = Math.atan2(dy, dx);

        if (e.kind === 'skeleton') {
          // Chaser / Flanker
          const flankOffset = (e.id % 2 === 0 ? 1 : -1) * 0.45;
          const baseAng = Math.atan2(dy, dx) + (dist > 1.8 ? flankOffset : 0);
          e.vx += (Math.cos(baseAng) * e.speed - e.vx) * Math.min(1, dt * 8);
          e.vy += (Math.sin(baseAng) * e.speed - e.vy) * Math.min(1, dt * 8);
          if (dist <= 1.35 && e.attackCooldown <= 0 && (activeTokens < MAX_ATTACK_TOKENS || e.hasToken)) {
            if (!e.hasToken) activeTokens++;
            e.hasToken = true;
            e.state = 'windup';
            e.stateTimer = e.windupDuration;
            e.aimAngle = Math.atan2(dy, dx);
          }
        } else if (e.kind === 'goblin') {
          // Ranged Kiter
          const n = normalizeVec(dx, dy);
          if (dist < 3.2) {
            e.vx += (-n.x * e.speed - e.vx) * Math.min(1, dt * 7);
            e.vy += (-n.y * e.speed - e.vy) * Math.min(1, dt * 7);
          } else if (dist > 6.0) {
            e.vx += (n.x * e.speed - e.vx) * Math.min(1, dt * 7);
            e.vy += (n.y * e.speed - e.vy) * Math.min(1, dt * 7);
          } else {
            // Strafe tangentially
            const sign = e.id % 2 === 0 ? 1 : -1;
            e.vx += (-n.y * sign * e.speed * 0.65 - e.vx) * Math.min(1, dt * 6);
            e.vy += (n.x * sign * e.speed * 0.65 - e.vy) * Math.min(1, dt * 6);
          }
          if (dist <= 7.2 && e.attackCooldown <= 0 && (activeTokens < MAX_ATTACK_TOKENS || e.hasToken)) {
            if (!e.hasToken) activeTokens++;
            e.hasToken = true;
            e.state = 'windup';
            e.stateTimer = e.windupDuration;
            e.aimAngle = Math.atan2(dy, dx);
          }
        } else if (e.kind === 'orc') {
          // Line-of-Sight Charger
          const n = normalizeVec(dx, dy);
          e.vx += (n.x * e.speed - e.vx) * Math.min(1, dt * 6);
          e.vy += (n.y * e.speed - e.vy) * Math.min(1, dt * 6);
          if (dist <= 5.2 && dist >= 1.1 && e.attackCooldown <= 0 && (activeTokens < MAX_ATTACK_TOKENS || e.hasToken)) {
            if (!e.hasToken) activeTokens++;
            e.hasToken = true;
            e.state = 'windup';
            e.stateTimer = e.windupDuration;
            e.aimAngle = Math.atan2(dy, dx);
            e.targetX = this.px;
            e.targetY = this.py;
          }
        } else if (e.kind === 'cultist') {
          // Area-Denial Pyromancer
          const n = normalizeVec(dx, dy);
          if (dist < 3.6) {
            e.vx += (-n.x * e.speed - e.vx) * Math.min(1, dt * 6);
            e.vy += (-n.y * e.speed - e.vy) * Math.min(1, dt * 6);
          } else if (dist > 6.5) {
            e.vx += (n.x * e.speed - e.vx) * Math.min(1, dt * 6);
            e.vy += (n.y * e.speed - e.vy) * Math.min(1, dt * 6);
          } else {
            e.vx *= 0.85;
            e.vy *= 0.85;
          }
          if (dist <= 7.5 && e.attackCooldown <= 0 && (activeTokens < MAX_ATTACK_TOKENS || e.hasToken)) {
            if (!e.hasToken) activeTokens++;
            e.hasToken = true;
            e.state = 'windup';
            e.stateTimer = e.windupDuration;
            e.targetX = this.px;
            e.targetY = this.py;
          }
        } else if (e.kind === 'boss') {
          // Lord Dinglepus!
          const n = normalizeVec(dx, dy);
          e.vx += (n.x * e.speed - e.vx) * Math.min(1, dt * 6);
          e.vy += (n.y * e.speed - e.vy) * Math.min(1, dt * 6);
          if (e.phase === 1 && e.hp <= e.maxHp * 0.6) {
            e.phase = 2;
            this.setBanner('Lord Dinglepus Enrages! Guard Summoned!', 2.4);
            const guard1 = this.spawnAdditionalSkeleton(e.x - 1.5, e.y + 1.2, e.roomId);
            const guard2 = this.spawnAdditionalSkeleton(e.x + 1.5, e.y - 1.2, e.roomId);
            this.floorData.enemies.push(guard1, guard2);
            this.totalEnemiesOnFloor += 2;
          }
          if (e.attackCooldown <= 0 && dist < 9.0) {
            e.state = 'windup';
            e.stateTimer = dist < 2.3 ? 0.55 : 0.72;
            e.aimAngle = Math.atan2(dy, dx);
            e.targetX = dist < 2.3 ? 0 : 1; // 0 = cleave, 1 = orb nova
          }
        }

        // Soft separation between enemies
        for (const other of this.floorData.enemies) {
          if (other === e || other.state === 'dying') continue;
          const sx = e.x - other.x;
          const sy = e.y - other.y;
          const sd = Math.hypot(sx, sy);
          const minD = e.radius + other.radius + 0.12;
          if (sd > 0.001 && sd < minD) {
            const push = (minD - sd) * 6;
            e.vx += (sx / sd) * push * dt * 10;
            e.vy += (sy / sd) * push * dt * 10;
          }
        }

        this.moveCircleInDungeon(e, e.radius, e.vx * dt, e.vy * dt);
      }

      e.gaitDist += Math.hypot(e.x - prevX, e.y - prevY) * 4.5;
    }

    // Prune completed KO animations
    this.floorData.enemies = this.floorData.enemies.filter((e) => e.state !== 'dying' || e.deathTimer > 0);
  }

  private spawnAdditionalSkeleton(x: number, y: number, roomId: number): EnemyEntity {
    const tx = clamp(Math.floor(x), 2, this.floorData.width - 3);
    const ty = clamp(Math.floor(y), 2, this.floorData.height - 3);
    const safe = isWalkableTile(this.getTileAt(tx, ty));
    return {
      id: this.nextEntityId++,
      kind: 'skeleton',
      name: 'Royal Guard',
      x: safe ? tx + 0.5 : this.px + 2.5,
      y: safe ? ty + 0.5 : this.py,
      vx: 0,
      vy: 0,
      facing: 0,
      hp: 64,
      maxHp: 64,
      radius: 0.34,
      speed: 2.8,
      damage: 16,
      state: 'chase',
      stateTimer: 0,
      windupDuration: 0.38,
      attackCooldown: 0.6,
      hitFlash: 0.2,
      squashX: 1,
      squashY: 1,
      gaitDist: 0,
      deathTimer: 0,
      hasToken: false,
      aimAngle: 0,
      targetX: 0,
      targetY: 0,
      phase: 0,
      roomId,
    };
  }

  private executeEnemyAttack(e: EnemyEntity): void {
    if (e.kind === 'skeleton') {
      e.state = 'attack';
      e.stateTimer = 0.16;
      e.squashX = 1.25;
      e.squashY = 0.8;
      this.slashEffects.push({
        x: e.x,
        y: e.y,
        angle: e.aimAngle,
        arc: Math.PI * 0.7,
        radius: 1.45,
        life: 0.14,
        maxLife: 0.14,
        color: '#f87171',
        comboStep: 0,
      });
      if (Math.hypot(this.px - e.x, this.py - e.y) <= 1.55) {
        this.damagePlayer(e.damage, e.x, e.y);
      }
    } else if (e.kind === 'goblin') {
      e.state = 'attack';
      e.stateTimer = 0.12;
      this.projectiles.push({
        id: this.nextEntityId++,
        fromPlayer: false,
        kind: 'bolt',
        x: e.x,
        y: e.y,
        vx: Math.cos(e.aimAngle) * 8.6,
        vy: Math.sin(e.aimAngle) * 8.6,
        radius: 0.2,
        damage: e.damage,
        life: 1.4,
        pierce: 1,
        hitIds: [],
        color: '#ef4444',
      });
    } else if (e.kind === 'orc') {
      e.state = 'attack';
      e.stateTimer = 0.45;
      e.vx = Math.cos(e.aimAngle) * 8.2;
      e.vy = Math.sin(e.aimAngle) * 8.2;
      e.squashX = 1.3;
      e.squashY = 0.75;
    } else if (e.kind === 'cultist') {
      e.state = 'attack';
      e.stateTimer = 0.18;
      this.hazards.push({
        id: this.nextEntityId++,
        x: e.targetX,
        y: e.targetY,
        radius: 1.35,
        timer: 0,
        duration: 0.55,
        triggered: false,
        damage: e.damage,
      });
    } else if (e.kind === 'boss') {
      e.state = 'attack';
      e.stateTimer = 0.22;
      if (e.targetX === 0) {
        // Royal Sceptre Cleave
        this.slashEffects.push({
          x: e.x,
          y: e.y,
          angle: e.aimAngle,
          arc: Math.PI * 1.4,
          radius: 2.55,
          life: 0.24,
          maxLife: 0.24,
          color: '#ef4444',
          comboStep: 2,
        });
        if (Math.hypot(this.px - e.x, this.py - e.y) <= 2.65) {
          this.damagePlayer(e.damage, e.x, e.y);
        }
      } else {
        // 8-orb radial dark magic ring
        const count = e.phase === 2 ? 12 : 8;
        for (let i = 0; i < count; i++) {
          const ang = e.aimAngle + (i / count) * Math.PI * 2;
          this.projectiles.push({
            id: this.nextEntityId++,
            fromPlayer: false,
            kind: 'boss_orb',
            x: e.x,
            y: e.y,
            vx: Math.cos(ang) * 6.8,
            vy: Math.sin(ang) * 6.8,
            radius: 0.28,
            damage: Math.round(e.damage * 0.78),
            life: 2.2,
            pierce: 1,
            hitIds: [],
            color: '#f43f5e',
          });
        }
      }
    }
  }

  private updateProjectiles(dt: number): void {
    const alive: Projectile[] = [];
    for (const proj of this.projectiles) {
      proj.life -= dt;
      if (proj.life <= 0) continue;

      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      const tile = this.getTileAt(Math.floor(proj.x), Math.floor(proj.y));
      if (!isWalkableTile(tile)) {
        for (let i = 0; i < 4; i++) {
          this.spawnParticle(proj.x, proj.y, 10, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 12, 2.5, 0.25, proj.color, 18);
        }
        continue;
      }

      if (proj.fromPlayer) {
        let consumed = false;
        for (const e of this.floorData.enemies) {
          if (e.state === 'dying' || proj.hitIds.includes(e.id)) continue;
          if (Math.hypot(e.x - proj.x, e.y - proj.y) <= e.radius + proj.radius) {
            proj.hitIds.push(e.id);
            const n = normalizeVec(proj.vx, proj.vy);
            this.damageEnemy(e, proj.damage, n.x * 3.8, n.y * 3.8, false);
            proj.pierce -= 1;
            if (proj.pierce <= 0) {
              consumed = true;
              break;
            }
          }
        }
        if (!consumed) {
          for (const prop of this.floorData.props) {
            if (prop.hp > 0 && Math.hypot(prop.x - proj.x, prop.y - proj.y) <= 0.55) {
              this.damageProp(prop, proj.damage);
              consumed = true;
              break;
            }
          }
        }
        if (!consumed) alive.push(proj);
      } else {
        if (Math.hypot(this.px - proj.x, this.py - proj.y) <= 0.38 + proj.radius) {
          this.damagePlayer(proj.damage, proj.x, proj.y);
          continue;
        }
        alive.push(proj);
      }
    }
    this.projectiles = alive;
  }

  private updateHazards(dt: number): void {
    const next: HazardZone[] = [];
    for (const h of this.hazards) {
      h.timer += dt;
      if (!h.triggered && h.timer >= h.duration) {
        h.triggered = true;
        if (Math.hypot(this.px - h.x, this.py - h.y) <= h.radius) {
          this.damagePlayer(h.damage, h.x, h.y);
        }
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 1 + Math.random() * 2.5;
          this.spawnParticle(h.x, h.y, 4, Math.cos(a) * sp, Math.sin(a) * sp, 26, 4, 0.4, '#f97316', 14);
        }
      }
      if (h.timer < h.duration + 0.25) {
        next.push(h);
      }
    }
    this.hazards = next;
  }

  private updatePickups(dt: number): void {
    const kept: PickupItem[] = [];
    for (const item of this.pickups) {
      item.age += dt;
      if (item.z > 0 || item.vz !== 0) {
        item.z += item.vz * dt;
        item.vz -= 68 * dt;
        if (item.z <= 0) {
          item.z = 0;
          item.vz = 0;
        }
      }

      const dist = Math.hypot(this.px - item.x, this.py - item.y);
      if (dist < 2.2 && item.age > 0.22) {
        const pull = normalizeVec(this.px - item.x, this.py - item.y);
        item.x += pull.x * dt * 6.5;
        item.y += pull.y * dt * 6.5;
      }

      if (dist < 0.72 && item.age > 0.18) {
        this.collectPickup(item);
        continue;
      }
      kept.push(item);
    }
    this.pickups = kept;
  }

  private collectPickup(item: PickupItem): void {
    soundFx.playPickup(item.kind);
    if (item.kind === 'coin') {
      this.runCoins += item.value;
      this.score += item.value * 5;
      this.floatingTexts.push({
        x: this.px,
        y: this.py,
        z: 28,
        vz: 18,
        text: `+${item.value}g`,
        color: '#fbbf24',
        life: 0.7,
        maxLife: 0.7,
        scale: 0.9,
      });
    } else if (item.kind === 'xp') {
      this.grantXp(item.value);
    } else if (item.kind === 'food') {
      this.hp = Math.min(this.maxHp, this.hp + item.value);
      this.floatingTexts.push({
        x: this.px,
        y: this.py,
        z: 28,
        vz: 20,
        text: `+${item.value} HP`,
        color: '#4ade80',
        life: 0.85,
        maxLife: 0.85,
        scale: 1.0,
      });
    } else if (item.kind === 'mana') {
      this.buster = Math.min(this.maxBuster, this.buster + item.value);
      this.floatingTexts.push({
        x: this.px,
        y: this.py,
        z: 28,
        vz: 20,
        text: `+${item.value}% BUSTER`,
        color: '#38bdf8',
        life: 0.85,
        maxLife: 0.85,
        scale: 0.95,
      });
    } else if (item.kind === 'weapon' && item.weaponDef) {
      if (item.weaponDef.damageBonus > this.equippedWeapon.damageBonus) {
        this.equippedWeapon = item.weaponDef;
        this.weaponLevel = Math.min(10, this.weaponLevel + 1);
        this.setBanner(`Equipped ${RARITY_LABELS[item.weaponDef.rarity]} ${item.weaponDef.name} (+${this.weaponLevel})!`, 2.4);
      } else {
        this.weaponLevel = Math.min(10, this.weaponLevel + 1);
        this.runCoins += 30;
        this.floatingTexts.push({
          x: this.px,
          y: this.py,
          z: 32,
          vz: 20,
          text: `WEAPON FORGED +${this.weaponLevel}! (+30g)`,
          color: item.weaponDef.color,
          life: 1.2,
          maxLife: 1.2,
          scale: 1.1,
        });
      }
    }
    this.emitHud(true);
  }

  private grantXp(amount: number): void {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.xpToNext = Math.round(this.xpToNext * 1.45);
      this.maxHp += 12;
      this.hp = Math.min(this.maxHp, this.hp + 25);
      this.floatingTexts.push({
        x: this.px,
        y: this.py,
        z: 42,
        vz: 22,
        text: `LEVEL ${this.level}!`,
        color: '#a78bfa',
        life: 1.25,
        maxLife: 1.25,
        scale: 1.2,
      });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        this.spawnParticle(this.px, this.py, 8, Math.cos(a) * 2.5, Math.sin(a) * 2.5, 22, 3.5, 0.5, '#c084fc', 10);
      }
    }
  }

  private damageEnemy(e: EnemyEntity, dmg: number, kbx: number, kby: number, heavy: boolean): void {
    // Check wall slam bonus!
    const testX = e.x + kbx * 0.14;
    const testY = e.y + kby * 0.14;
    const slammedWall = !isWalkableTile(this.getTileAt(Math.floor(testX), Math.floor(testY)));
    const finalDmg = slammedWall ? dmg + 12 : dmg;

    e.hp -= finalDmg;
    e.hitFlash = 0.08;
    e.squashX = 0.78;
    e.squashY = 1.24;
    e.vx += kbx;
    e.vy += kby;
    this.moveCircleInDungeon(e, e.radius, kbx * 0.08, kby * 0.08);

    // Interrupt non-boss windup slightly or reward combo + buster
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboDecayTimer = 3.2;
    this.buster = Math.min(this.maxBuster, this.buster + (heavy ? 12 : 7));

    soundFx.playHit(heavy || slammedWall);
    if (heavy || slammedWall) {
      this.hitstop = Math.max(this.hitstop, 0.04);
      this.trauma = Math.min(1, this.trauma + 0.28);
    }

    this.floatingTexts.push({
      x: e.x,
      y: e.y,
      z: 26,
      vz: 24,
      text: slammedWall ? `${finalDmg} SLAM!` : `${finalDmg}`,
      color: slammedWall ? '#fbbf24' : heavy ? '#fca5a5' : '#ffffff',
      life: 0.65,
      maxLife: 0.65,
      scale: heavy || slammedWall ? 1.15 : 0.92,
    });

    for (let i = 0; i < (heavy ? 12 : 6); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.2 + Math.random() * 2.8;
      this.spawnParticle(
        e.x,
        e.y,
        12,
        Math.cos(a) * sp + kbx * 0.2,
        Math.sin(a) * sp + kby * 0.2,
        16 + Math.random() * 14,
        heavy ? 3.8 : 2.8,
        0.38,
        e.kind === 'skeleton' ? '#e2e8f0' : '#ef4444',
        26
      );
    }

    if (e.hp <= 0) {
      e.hp = 0;
      e.state = 'dying';
      e.deathTimer = 0.36;
      e.hasToken = false;
      e.vx = kbx * 0.7;
      e.vy = kby * 0.7;
      this.kills += 1;
      this.hitstop = Math.max(this.hitstop, e.kind === 'boss' ? 0.08 : e.isElite ? 0.06 : 0.045);
      this.trauma = Math.min(1, this.trauma + (e.kind === 'boss' ? 0.75 : e.isElite ? 0.5 : 0.32));

      const basePts = e.kind === 'boss' ? 1200 : e.kind === 'orc' ? 160 : e.kind === 'cultist' ? 130 : 90;
      const eliteMult = e.isElite ? 2.5 : 1;
      this.score += Math.round(computeKillScore(basePts, this.combo, this.currentFloor) * eliteMult);
      this.buster = Math.min(this.maxBuster, this.buster + (e.isElite ? 24 : 10));

      if (e.isElite) {
        this.floatingTexts.push({
          x: e.x,
          y: e.y,
          z: 36,
          vz: 26,
          text: 'CHAMPION SLAIN!',
          color: '#fbbf24',
          life: 1.25,
          maxLife: 1.25,
          scale: 1.25,
        });
      }

      // Guaranteed coins + XP + chance for Food or Mana!
      const coinAmt = e.kind === 'boss' ? 80 : e.isElite ? 36 : e.kind === 'orc' ? 14 : 8;
      const xpAmt = e.kind === 'boss' ? 100 : e.isElite ? 55 : 18;
      this.spawnPickup('coin', e.x, e.y, coinAmt);
      this.spawnPickup('xp', e.x + 0.2, e.y - 0.15, xpAmt);

      if (e.isElite) {
        this.spawnPickup('food', e.x - 0.25, e.y + 0.2, 28);
        this.spawnPickup('mana', e.x + 0.25, e.y + 0.2, 28);
      } else {
        const roll = Math.random();
        if (roll < 0.28) {
          this.spawnPickup('food', e.x - 0.2, e.y + 0.2, 22);
        } else if (roll < 0.52) {
          this.spawnPickup('mana', e.x - 0.2, e.y + 0.2, 22);
        }
      }
    }
  }

  private damageProp(prop: { id: number; kind: string; x: number; y: number; hp: number; hitFlash: number; opened?: boolean }, dmg: number): void {
    if (prop.kind === 'chest') {
      if (!prop.opened) {
        this.openChest(prop);
      }
      return;
    }
    prop.hp -= dmg;
    prop.hitFlash = 0.08;
    soundFx.playCrateBreak();
    if (prop.hp <= 0) {
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 2.6;
        this.spawnParticle(prop.x, prop.y, 10, Math.cos(a) * sp, Math.sin(a) * sp, 18, 3.6, 0.42, '#b45309', 26);
      }
      const r = Math.random();
      if (r < 0.42) this.spawnPickup('coin', prop.x, prop.y, 6);
      else if (r < 0.68) this.spawnPickup('food', prop.x, prop.y, 20);
      else if (r < 0.9) this.spawnPickup('mana', prop.x, prop.y, 20);
      else this.spawnPickup('xp', prop.x, prop.y, 14);
    }
  }

  private openChest(prop: { x: number; y: number; opened?: boolean }): void {
    prop.opened = true;
    soundFx.playPickup('weapon');
    this.spawnPickup('coin', prop.x - 0.35, prop.y, 25);
    this.spawnPickup('xp', prop.x + 0.35, prop.y, 28);

    // Roll weapon tier (Common/Rare/Epic/Legendary) weighted by floor
    const weapons = HERO_CLASSES[this.heroClassId].weapons;
    const r = Math.random() + (this.currentFloor - 1) * 0.2;
    const tierIdx = r > 1.15 ? 3 : r > 0.78 ? 2 : r > 0.35 ? 1 : 0;
    const weaponDef = weapons[tierIdx];

    this.pickups.push({
      id: this.nextEntityId++,
      kind: 'weapon',
      x: prop.x,
      y: prop.y + 0.45,
      z: 18,
      vz: 26,
      value: 1,
      age: 0,
      weaponDef,
    });

    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.spawnParticle(prop.x, prop.y, 12, Math.cos(a) * 2.5, Math.sin(a) * 2.5, 22, 3.5, 0.5, weaponDef.color, 18);
    }
  }

  private spawnPickup(kind: PickupItem['kind'], x: number, y: number, value: number): void {
    this.pickups.push({
      id: this.nextEntityId++,
      kind,
      x: x + (Math.random() - 0.5) * 0.35,
      y: y + (Math.random() - 0.5) * 0.35,
      z: 14,
      vz: 22 + Math.random() * 10,
      value,
      age: 0,
    });
  }

  private damagePlayer(dmg: number, sourceX: number, sourceY: number): void {
    if (this.invulnTimer > 0 || this.pendingDefeat) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.invulnTimer = 0.52;
    this.playerHitFlash = 0.12;
    this.combo = 0;
    this.trauma = Math.min(1, this.trauma + 0.55);
    this.hitstop = Math.max(this.hitstop, 0.04);
    soundFx.playPlayerHurt();

    const kb = normalizeVec(this.px - sourceX, this.py - sourceY);
    this.pvx += kb.x * 6;
    this.pvy += kb.y * 6;

    this.floatingTexts.push({
      x: this.px,
      y: this.py,
      z: 30,
      vz: 22,
      text: `-${dmg}`,
      color: '#ef4444',
      life: 0.75,
      maxLife: 0.75,
      scale: 1.1,
    });

    if (this.hp <= 0) {
      this.pendingDefeat = true;
      this.defeatDelayTimer = 0.5;
      soundFx.playDefeat();
    }
    this.emitHud(true);
  }

  private updateFloorProgress(): void {
    const aliveEnemies = this.floorData.enemies.filter((e) => e.state !== 'dying').length;
    if (aliveEnemies === 0 && !this.floorData.portalOpen) {
      if (this.currentFloor >= MAX_FLOORS) {
        // Defeated Lord Dinglepus and cleared Floor 3!
        this.finishRun(true);
        return;
      }
      this.floorData.portalOpen = true;
      soundFx.playVictory();
      this.setBanner('Floor Cleared! Enter the Glowing Exit Portal!', 3.2);
    }

    if (this.floorData.portalOpen && Math.hypot(this.px - this.floorData.portalX, this.py - this.floorData.portalY) < 1.1) {
      this.currentFloor += 1;
      this.floorData = generateDungeonFloor(this.currentFloor, this.runSeed);
      this.buildTorchGlowSprite(this.currentFloor);
      this.resetHeroToFloorSpawn();
      this.spawnPetNearHero();
      this.hp = Math.min(this.maxHp, this.hp + 30);
      this.setBanner(
        this.currentFloor === MAX_FLOORS
          ? `Floor 3 · ${this.floorData.themeName}`
          : `Floor ${this.currentFloor} · ${this.floorData.themeName}`,
        2.8
      );
      this.emitHud(true);
    }
  }

  private finishRun(victory: boolean): void {
    this.clearInputs();
    this.gameState = victory ? 'victory' : 'gameover';
    if (victory) {
      this.score += 1500;
      soundFx.playVictory();
    }
    this.syncBodyState();
    this.onRunEnd({
      coinsEarned: this.runCoins,
      score: this.score,
      victory,
    });
    this.emitHud(true);
  }

  private updateParticles(dt: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= p.gravity * dt;
      if (p.z < 0) {
        p.z = 0;
        p.vz *= -0.35;
      }
    }
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    maxLife: number,
    color: string,
    gravity: number
  ): void {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;
    p.active = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.size = size;
    p.life = maxLife;
    p.maxLife = maxLife;
    p.color = color;
    p.gravity = gravity;
  }

  private updateFloatingTexts(dt: number): void {
    const next: FloatingText[] = [];
    for (const ft of this.floatingTexts) {
      ft.life -= dt;
      if (ft.life <= 0) continue;
      ft.z += ft.vz * dt;
      ft.vz *= 0.92;
      next.push(ft);
    }
    this.floatingTexts = next;
  }

  private updateSlashArcs(dt: number): void {
    const next: SlashArcEffect[] = [];
    for (const s of this.slashEffects) {
      s.life -= dt;
      if (s.life > 0) next.push(s);
    }
    this.slashEffects = next;
  }

  private getTileAt(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= this.floorData.width || ty >= this.floorData.height) return 'void';
    return this.floorData.tiles[ty][tx];
  }

  private moveCircleInDungeon(ent: { x: number; y: number }, radius: number, dx: number, dy: number): void {
    const tryMove = (nx: number, ny: number): boolean => {
      const checks = [
        [nx - radius, ny - radius],
        [nx + radius, ny - radius],
        [nx - radius, ny + radius],
        [nx + radius, ny + radius],
      ];
      for (const [cx, cy] of checks) {
        if (!isWalkableTile(this.getTileAt(Math.floor(cx), Math.floor(cy)))) {
          return false;
        }
      }
      return true;
    };

    if (tryMove(ent.x + dx, ent.y)) {
      ent.x += dx;
    }
    if (tryMove(ent.x, ent.y + dy)) {
      ent.y += dy;
    }
  }

  private revealFogAround(wx: number, wy: number, radius: number): void {
    const cx = Math.floor(wx);
    const cy = Math.floor(wy);
    const r2 = radius * radius;
    for (let y = Math.max(0, cy - radius); y <= Math.min(this.floorData.height - 1, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x <= Math.min(this.floorData.width - 1, cx + radius); x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) {
          this.floorData.discovered[y][x] = true;
        }
      }
    }
  }

  private emitHud(force: boolean): void {
    const boss = this.floorData.enemies.find((e) => e.kind === 'boss' && e.state !== 'dying');
    const alive = this.floorData.enemies.filter((e) => e.state !== 'dying').length;
    const cfg = HERO_CLASSES[this.heroClassId];
    const upgradeCost = this.getWeaponUpgradeCost();
    const canUpgrade = this.runCoins >= upgradeCost && this.weaponLevel < 10;

    const snap: HudSnapshot = {
      gameState: this.gameState,
      heroClass: this.heroClassId,
      petId: this.petId,
      weapon: this.equippedWeapon,
      weaponLevel: this.weaponLevel,
      weaponUpgradeCost: upgradeCost,
      canUpgradeWeapon: canUpgrade,
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNext,
      hp: Math.round(this.hp),
      maxHp: Math.round(this.maxHp),
      ghostHp: Math.round(this.ghostHp),
      buster: Math.round(this.buster),
      maxBuster: this.maxBuster,
      busterReady: this.buster >= this.maxBuster,
      dashReadyRatio: clamp(1 - this.dashCooldown / cfg.dashCooldown, 0, 1),
      floor: this.currentFloor,
      maxFloors: MAX_FLOORS,
      floorTheme: this.floorData.themeName,
      enemiesRemaining: alive,
      totalEnemies: this.totalEnemiesOnFloor,
      portalOpen: this.floorData.portalOpen,
      score: Math.round(this.score),
      bestScore: Math.max(this.bestScore, Math.round(this.score)),
      runCoins: this.runCoins,
      bankCoins: this.bankCoins + this.runCoins,
      combo: this.combo,
      maxCombo: this.maxCombo,
      kills: this.kills,
      elapsedSeconds: Math.floor(this.elapsedSeconds),
      bossName: boss && Math.hypot(boss.x - this.px, boss.y - this.py) < 12 ? boss.name : null,
      bossHp: boss ? Math.round(boss.hp) : 0,
      bossMaxHp: boss ? boss.maxHp : 1,
      muted: soundFx.isMuted(),
      bannerText: this.bannerText,
    };
    const key = `${snap.gameState}|${snap.heroClass}|${snap.petId}|${snap.weapon.id}|${snap.weaponLevel}|${snap.canUpgradeWeapon}|${snap.level}|${snap.xp}|${snap.hp}|${snap.ghostHp}|${snap.buster}|${snap.floor}|${snap.enemiesRemaining}|${snap.portalOpen}|${snap.score}|${snap.runCoins}|${snap.combo}|${snap.bossHp}|${snap.muted}|${snap.bannerText ?? ''}`;
    if (force || (this.gameState === 'playing' && key !== this.lastHudKey)) {
      this.lastHudKey = key;
      this.onHudUpdate(snap);
    }
  }

  // ==================== RENDERING ====================

  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = w / dpr;
    const cssH = h / dpr;
    const palette = FLOOR_PALETTES[this.currentFloor] ?? FLOOR_PALETTES[1];

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background dungeon void
    ctx.fillStyle = palette.fogBg;
    ctx.fillRect(0, 0, cssW, cssH);

    // Trauma-squared camera shake
    const shakeMag = this.trauma * this.trauma * 12;
    const shakeX = shakeMag * (Math.random() * 2 - 1);
    const shakeY = shakeMag * (Math.random() * 2 - 1);

    const originX = cssW * 0.5 - this.camX + shakeX;
    const originY = cssH * 0.5 - this.camY + shakeY;

    ctx.save();
    ctx.translate(originX, originY);

    // Determine visible world bounds in tiles with tight viewport culling
    const camWorld = {
      x: (this.camX / TILE_HALF_W + this.camY / TILE_HALF_H) * 0.5,
      y: (this.camY / TILE_HALF_H - this.camX / TILE_HALF_W) * 0.5,
    };
    const minTx = Math.max(0, Math.floor(camWorld.x - 22));
    const maxTx = Math.min(this.floorData.width - 1, Math.ceil(camWorld.x + 22));
    const minTy = Math.max(0, Math.floor(camWorld.y - 22));
    const maxTy = Math.min(this.floorData.height - 1, Math.ceil(camWorld.y + 22));

    const cullW = cssW * 0.58 + TILE_HALF_W * 2;
    const cullH = cssH * 0.62 + TILE_HALF_H * 4 + WALL_HEIGHT;

    // Pass 1: Batched isometric floor tiles (2 fill calls instead of 400+)
    const specialTiles: Array<{ tile: 'spikes' | 'portal'; x: number; y: number }> = [];

    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          const tile = this.floorData.tiles[ty][tx];
          if (tile === 'void' || tile === 'wall') continue;
          const checker = (tx + ty) % 2;
          if (checker !== pass) continue;

          const iso = worldToIso(tx + 0.5, ty + 0.5);
          if (Math.abs(iso.x - this.camX) > cullW || Math.abs(iso.y - this.camY) > cullH) continue;

          ctx.moveTo(iso.x, iso.y - TILE_HALF_H);
          ctx.lineTo(iso.x + TILE_HALF_W, iso.y);
          ctx.lineTo(iso.x, iso.y + TILE_HALF_H);
          ctx.lineTo(iso.x - TILE_HALF_W, iso.y);
          ctx.closePath();

          if (tile === 'spikes' || tile === 'portal') {
            specialTiles.push({ tile, x: iso.x, y: iso.y });
          }
        }
      }
      ctx.fillStyle = pass === 0 ? palette.floorLight : palette.floorDark;
      ctx.fill();
    }

    for (const st of specialTiles) {
      if (st.tile === 'spikes') {
        this.drawSpikes(ctx, st.x, st.y);
      } else {
        this.drawPortal(ctx, st.x, st.y, this.floorData.portalOpen);
      }
    }

    // Pass 2: Ground telegraphs & hazard zones
    for (const hZone of this.hazards) {
      const iso = worldToIso(hZone.x, hZone.y);
      const progress = clamp(hZone.timer / hZone.duration, 0, 1);
      ctx.save();
      ctx.translate(iso.x, iso.y);
      ctx.scale(1, 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, hZone.radius * TILE_HALF_W, 0, Math.PI * 2);
      ctx.fillStyle = hZone.triggered ? 'rgba(249,115,22,0.45)' : 'rgba(239,68,68,0.18)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ef4444';
      ctx.stroke();
      // Expanding inner charge circle
      ctx.beginPath();
      ctx.arc(0, 0, hZone.radius * TILE_HALF_W * progress, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(249,115,22,0.34)';
      ctx.fill();
      ctx.restore();
    }

    // Enemy telegraphs (Goblin laser sight, Orc charge corridor, Boss ring)
    for (const e of this.floorData.enemies) {
      if (e.state !== 'windup') continue;
      const iso = worldToIso(e.x, e.y);
      const prog = 1 - clamp(e.stateTimer / Math.max(0.1, e.windupDuration), 0, 1);
      if (e.kind === 'goblin') {
        const endIso = worldToIso(e.x + Math.cos(e.aimAngle) * 7.5, e.y + Math.sin(e.aimAngle) * 7.5);
        ctx.save();
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.35 + prog * 0.6})`;
        ctx.lineWidth = 1.5 + prog * 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(iso.x, iso.y - 10);
        ctx.lineTo(endIso.x, endIso.y - 10);
        ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'orc') {
        const endIso = worldToIso(e.x + Math.cos(e.aimAngle) * 4.2, e.y + Math.sin(e.aimAngle) * 4.2);
        ctx.save();
        ctx.strokeStyle = `rgba(249, 115, 22, ${0.3 + prog * 0.55})`;
        ctx.lineWidth = 18;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(iso.x, iso.y);
        ctx.lineTo(endIso.x, endIso.y);
        ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'boss' && e.targetX === 0) {
        ctx.save();
        ctx.translate(iso.x, iso.y);
        ctx.scale(1, 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, 2.55 * TILE_HALF_W, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239,68,68,${0.12 + prog * 0.25})`;
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Pass 3: Depth-sorted isometric walls, pillars, props, pickups, hero, pet, enemies, projectiles
    const renderList: RenderItem[] = [];

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const tile = this.floorData.tiles[ty][tx];
        if (tile !== 'wall' && tile !== 'pillar') continue;
        const iso = worldToIso(tx + 0.5, ty + 0.5);
        if (Math.abs(iso.x - this.camX) > cullW || Math.abs(iso.y - this.camY) > cullH) continue;
        const depth = tx + ty + 1;
        if (tile === 'wall') {
          renderList.push({
            depth,
            draw: (c) => this.drawIsoBlock(c, tx + 0.5, ty + 0.5, WALL_HEIGHT, palette.wallTop, palette.wallLeft, palette.wallRight, 1),
          });
        } else {
          renderList.push({
            depth,
            draw: (c) => this.drawIsoBlock(c, tx + 0.5, ty + 0.5, PILLAR_HEIGHT, '#645d75', '#464154', '#312d3b', 0.65),
          });
        }
      }
    }

    // Torches (glow pools)
    for (const t of this.floorData.torches) {
      if (t.x < minTx - 2 || t.x > maxTx + 2 || t.y < minTy - 2 || t.y > maxTy + 2) continue;
      renderList.push({
        depth: t.x + t.y + 0.1,
        draw: (c) => this.drawTorch(c, t.x, t.y, t.phase, palette.ambientGlow),
      });
    }

    // Props
    for (const prop of this.floorData.props) {
      if (prop.hp <= 0) continue;
      renderList.push({
        depth: prop.x + prop.y,
        draw: (c) => this.drawProp(c, prop),
      });
    }

    // Pickups
    for (const item of this.pickups) {
      renderList.push({
        depth: item.x + item.y,
        draw: (c) => this.drawPickup(c, item),
      });
    }

    // Enemies
    for (const e of this.floorData.enemies) {
      renderList.push({
        depth: e.x + e.y,
        draw: (c) => this.drawEnemy(c, e),
      });
    }

    // Pet
    if (this.pet && this.gameState !== 'title') {
      const petRef = this.pet;
      renderList.push({
        depth: petRef.x + petRef.y,
        draw: (c) => this.drawPet(c, petRef),
      });
    }

    // Hero (hidden during title tour so title scene showcases dungeon ambiance cleanly)
    if (this.gameState !== 'title') {
      renderList.push({
        depth: this.px + this.py,
        draw: (c) => this.drawHero(c),
      });
    }

    // Projectiles
    for (const proj of this.projectiles) {
      renderList.push({
        depth: proj.x + proj.y + 0.2,
        draw: (c) => this.drawProjectile(c, proj),
      });
    }

    renderList.sort((a, b) => a.depth - b.depth);
    for (const item of renderList) {
      item.draw(ctx);
    }

    // Pass 4: Slash arcs, particles, floating combat numbers
    for (const s of this.slashEffects) {
      this.drawSlashArc(ctx, s);
    }
    this.drawParticles(ctx);
    this.drawFloatingTexts(ctx);

    ctx.restore(); // end world transform

    // Peripheral low-HP crimson vignette (< 30% HP)
    if (this.gameState === 'playing' && this.hp < this.maxHp * 0.32) {
      const pulse = 0.22 + Math.sin(this.worldTime * 7) * 0.08;
      const grad = ctx.createRadialGradient(cssW * 0.5, cssH * 0.5, cssH * 0.3, cssW * 0.5, cssH * 0.5, cssW * 0.72);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(185, 28, 28, ${pulse})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cssW, cssH);
    }

    ctx.restore();

    // Render live minimap at ~6Hz instead of every frame
    if (this.minimapTimer <= 0) {
      this.minimapTimer = 0.16;
      this.renderMinimap();
    }
  }

  private drawIsoBlock(
    ctx: CanvasRenderingContext2D,
    wx: number,
    wy: number,
    height: number,
    topColor: string,
    leftColor: string,
    rightColor: string,
    scale: number
  ): void {
    const iso = worldToIso(wx, wy);
    const hw = TILE_HALF_W * scale;
    const hh = TILE_HALF_H * scale;

    // Left face
    ctx.beginPath();
    ctx.moveTo(iso.x - hw, iso.y - height);
    ctx.lineTo(iso.x, iso.y + hh - height);
    ctx.lineTo(iso.x, iso.y + hh);
    ctx.lineTo(iso.x - hw, iso.y);
    ctx.closePath();
    ctx.fillStyle = leftColor;
    ctx.fill();

    // Right face
    ctx.beginPath();
    ctx.moveTo(iso.x + hw, iso.y - height);
    ctx.lineTo(iso.x, iso.y + hh - height);
    ctx.lineTo(iso.x, iso.y + hh);
    ctx.lineTo(iso.x + hw, iso.y);
    ctx.closePath();
    ctx.fillStyle = rightColor;
    ctx.fill();

    // Top diamond face
    ctx.beginPath();
    ctx.moveTo(iso.x, iso.y - hh - height);
    ctx.lineTo(iso.x + hw, iso.y - height);
    ctx.lineTo(iso.x, iso.y + hh - height);
    ctx.lineTo(iso.x - hw, iso.y - height);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();
  }

  private drawSpikes(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = '#475569';
    const pts = [
      [-12, -2],
      [12, -2],
      [0, -8],
      [0, 5],
    ];
    for (const [ox, oy] of pts) {
      ctx.beginPath();
      ctx.moveTo(x + ox - 3, y + oy);
      ctx.lineTo(x + ox, y + oy - 9);
      ctx.lineTo(x + ox + 3, y + oy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  private drawPortal(ctx: CanvasRenderingContext2D, x: number, y: number, open: boolean): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.52);
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fillStyle = open ? '#0f172a' : '#1f2937';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = open ? '#38bdf8' : '#475569';
    ctx.stroke();

    if (open) {
      const pulse = 13 + Math.sin(this.worldTime * 5) * 3;
      ctx.beginPath();
      ctx.arc(0, 0, pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.fill();
    }
    ctx.restore();
  }

  private drawTorch(ctx: CanvasRenderingContext2D, wx: number, wy: number, phase: number, _glow: string): void {
    const iso = worldToIso(wx, wy);
    const flicker = 0.9 + Math.sin(this.worldTime * 11 + phase) * 0.1;
    ctx.save();
    // Cached soft radial torchlight sprite
    if (this.torchGlowCanvas) {
      const sz = 170 * flicker;
      ctx.drawImage(this.torchGlowCanvas, iso.x - sz * 0.5, iso.y - 10 - sz * 0.5, sz, sz);
    }

    // Iron sconce + flame
    ctx.fillStyle = '#334155';
    ctx.fillRect(iso.x - 2, iso.y - 20, 4, 14);
    ctx.beginPath();
    ctx.arc(iso.x, iso.y - 23, 5 * flicker, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(iso.x, iso.y - 24, 2.5 * flicker, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
    ctx.restore();
  }

  private drawProp(ctx: CanvasRenderingContext2D, prop: { kind: string; x: number; y: number; hitFlash: number; opened?: boolean }): void {
    const iso = worldToIso(prop.x, prop.y);
    const flash = prop.hitFlash > 0;
    ctx.save();
    ctx.translate(iso.x, iso.y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (prop.kind === 'chest') {
      const opened = Boolean(prop.opened);
      ctx.fillStyle = flash ? '#ffffff' : '#78350f';
      ctx.fillRect(-13, -15, 26, 15);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(-13, -15, 26, 15);
      // Lid
      ctx.fillStyle = opened ? '#451a03' : '#92400e';
      ctx.fillRect(-14, opened ? -22 : -19, 28, 6);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-3, -12, 6, 5);
    } else if (prop.kind === 'barrel') {
      ctx.fillStyle = flash ? '#ffffff' : '#92400e';
      ctx.beginPath();
      ctx.ellipse(0, -10, 10, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.strokeStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(-9, -12);
      ctx.lineTo(9, -12);
      ctx.moveTo(-9, -6);
      ctx.lineTo(9, -6);
      ctx.stroke();
    } else if (prop.kind === 'urn') {
      ctx.fillStyle = flash ? '#ffffff' : '#64748b';
      ctx.beginPath();
      ctx.ellipse(0, -10, 8, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-5, -21, 10, 3);
    } else {
      // Crate
      ctx.fillStyle = flash ? '#ffffff' : '#b45309';
      ctx.fillRect(-10, -18, 20, 18);
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-10, -18, 20, 18);
      ctx.beginPath();
      ctx.moveTo(-10, -18);
      ctx.lineTo(10, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPickup(ctx: CanvasRenderingContext2D, item: PickupItem): void {
    const iso = worldToIso(item.x, item.y);
    const bob = Math.sin(this.worldTime * 6 + item.id) * 3;
    ctx.save();
    ctx.translate(iso.x, iso.y - item.z - 6 + bob);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, item.z + 8 - bob, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (item.kind === 'coin') {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (item.kind === 'xp') {
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
    } else if (item.kind === 'food') {
      // Roast drumstick
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(-2, 0, 7, 5, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(4, -2, 5, 3);
    } else if (item.kind === 'mana') {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 3);
      ctx.lineTo(-5, 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (item.kind === 'weapon' && item.weaponDef) {
      const col = RARITY_COLORS[item.weaponDef.rarity];
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1.5, -6, 3, 12);
    }
    ctx.restore();
  }

  private drawHero(ctx: CanvasRenderingContext2D): void {
    const cfg = HERO_CLASSES[this.heroClassId];
    const iso = worldToIso(this.px, this.py);
    const bob = Math.abs(Math.sin(this.playerGait)) * 4;
    const blinkHide = this.invulnTimer > 0 && Math.floor(this.worldTime * 24) % 2 === 0 && this.dashTimer <= 0;

    ctx.save();
    ctx.translate(iso.x, iso.y);

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (blinkHide) {
      ctx.globalAlpha = 0.55;
    }

    ctx.translate(0, -bob);
    ctx.scale(this.playerSquashX, this.playerSquashY);

    const flash = this.playerHitFlash > 0;
    const facingX = Math.cos(this.pFacing - Math.PI * 0.25);

    // Cape
    ctx.fillStyle = flash ? '#ffffff' : cfg.capeColor;
    ctx.beginPath();
    ctx.moveTo(-facingX * 4, -22);
    ctx.lineTo(-facingX * 14 - 5, -4);
    ctx.lineTo(-facingX * 14 + 5, -4);
    ctx.closePath();
    ctx.fill();

    // Torso
    ctx.fillStyle = flash ? '#ffffff' : cfg.primaryColor;
    ctx.beginPath();
    ctx.roundRect(-9, -24, 18, 18, 4);
    ctx.fill();
    ctx.strokeStyle = '#0e0c0f';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Head / Helm
    ctx.fillStyle = flash ? '#ffffff' : '#fde68a';
    ctx.beginPath();
    ctx.arc(0, -30, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e0c0f';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Distinct silhouette headgear per hero!
    if (!flash) {
      ctx.fillStyle = cfg.accentColor;
      if (this.heroClassId === 'berserker') {
        // Horned helm
        ctx.beginPath();
        ctx.moveTo(-7, -33);
        ctx.lineTo(-12, -41);
        ctx.lineTo(-4, -36);
        ctx.moveTo(7, -33);
        ctx.lineTo(12, -41);
        ctx.lineTo(4, -36);
        ctx.fill();
      } else if (this.heroClassId === 'chef_samurai') {
        // Spectral Chef Hat!
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-6, -44, 12, 9);
        ctx.beginPath();
        ctx.arc(0, -44, 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.heroClassId === 'vampire_hunter') {
        // Wide brimmed hunter hat
        ctx.fillStyle = '#1e1b24';
        ctx.fillRect(-11, -36, 22, 3);
        ctx.fillRect(-6, -42, 12, 6);
      } else if (this.heroClassId === 'sorcerer') {
        // Pointed wizard hat
        ctx.fillStyle = '#1e3a8a';
        ctx.beginPath();
        ctx.moveTo(-10, -34);
        ctx.lineTo(0, -47);
        ctx.lineTo(10, -34);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Weapon in hand (distinct silhouette per hero class)
    const swingAngle = this.swingAnimTimer > 0 ? Math.sin((this.swingAnimTimer / 0.2) * Math.PI) * 1.15 : 0;
    ctx.save();
    ctx.translate(facingX >= 0 ? 10 : -10, -16);
    ctx.rotate((facingX >= 0 ? 0.5 : -0.5) + swingAngle);
    const wColor = this.equippedWeapon.color;
    if (this.heroClassId === 'berserker') {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-1.5, -18, 3, 20);
      ctx.fillStyle = wColor;
      ctx.beginPath();
      ctx.moveTo(-8, -18);
      ctx.lineTo(8, -18);
      ctx.lineTo(5, -10);
      ctx.lineTo(-5, -10);
      ctx.closePath();
      ctx.fill();
    } else if (this.heroClassId === 'battle') {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-1.5, -17, 3, 19);
      ctx.fillStyle = wColor;
      ctx.fillRect(-7, -21, 14, 7);
    } else if (this.heroClassId === 'ranger') {
      ctx.strokeStyle = wColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -8, 10, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
    } else if (this.heroClassId === 'sorcerer') {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-1.5, -18, 3, 20);
      ctx.fillStyle = wColor;
      ctx.beginPath();
      ctx.arc(0, -20, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.heroClassId === 'vampire_hunter') {
      ctx.fillStyle = '#451a03';
      ctx.fillRect(-1.5, -14, 3, 14);
      ctx.fillStyle = wColor;
      ctx.fillRect(-6, -13, 12, 3);
    } else {
      // Chef Ghost Samurai curved cleaver-katana
      ctx.fillStyle = wColor;
      ctx.beginPath();
      ctx.moveTo(-1, 0);
      ctx.lineTo(2, -21);
      ctx.lineTo(5, -18);
      ctx.lineTo(2, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }

  private drawPet(ctx: CanvasRenderingContext2D, pet: PetEntity): void {
    const cfg = PET_CONFIGS[pet.id];
    const iso = worldToIso(pet.x, pet.y);
    const bob = pet.id === 'dragon' ? 12 + Math.sin(this.worldTime * 8) * 3 : Math.abs(Math.sin(pet.gaitDist)) * 3;

    ctx.save();
    ctx.translate(iso.x, iso.y);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, -bob);
    ctx.scale(pet.squashX, pet.squashY);

    ctx.fillStyle = cfg.primaryColor;
    ctx.beginPath();
    ctx.ellipse(0, -8, pet.id === 'rhino' ? 11 : 8, pet.id === 'rhino' ? 8 : 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0e0c0f';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Distinct feature: Wolf ears / Rhino horn / Dragon wings
    ctx.fillStyle = cfg.accentColor;
    if (pet.id === 'wolf') {
      ctx.beginPath();
      ctx.moveTo(-5, -13);
      ctx.lineTo(-7, -20);
      ctx.lineTo(-2, -14);
      ctx.moveTo(5, -13);
      ctx.lineTo(7, -20);
      ctx.lineTo(2, -14);
      ctx.fill();
    } else if (pet.id === 'rhino') {
      ctx.beginPath();
      ctx.moveTo(6, -10);
      ctx.lineTo(14, -15);
      ctx.lineTo(8, -6);
      ctx.closePath();
      ctx.fill();
    } else if (pet.id === 'dragon') {
      const flap = Math.sin(this.worldTime * 14) * 5;
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.lineTo(-14, -18 + flap);
      ctx.lineTo(-8, -6);
      ctx.moveTo(4, -10);
      ctx.lineTo(14, -18 + flap);
      ctx.lineTo(8, -6);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: EnemyEntity): void {
    const iso = worldToIso(e.x, e.y);
    const bob = e.state === 'dying' ? 0 : Math.abs(Math.sin(e.gaitDist)) * 3.5;

    ctx.save();
    ctx.translate(iso.x, iso.y);

    if (e.state === 'dying') {
      const t = clamp(e.deathTimer / 0.36, 0, 1);
      ctx.globalAlpha = t;
      ctx.rotate((1 - t) * 1.4);
    }

    // Shadow
    const radPx = e.radius * 34;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 3, radPx, radPx * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (e.isElite) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(0, 3, radPx * 1.3, radPx * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.translate(0, -bob);
    ctx.scale(e.squashX, e.squashY);

    const flash = e.hitFlash > 0;
    const isWindup = e.state === 'windup';

    if (e.kind === 'skeleton') {
      ctx.fillStyle = flash ? '#ffffff' : isWindup ? '#fecaca' : '#e2e8f0';
      ctx.beginPath();
      ctx.roundRect(-7, -21, 14, 15, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -27, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Eye sockets + bone blade
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-3.5, -28, 2.2, 2.5);
      ctx.fillRect(1.3, -28, 2.2, 2.5);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(8, -22, 3, 13);
    } else if (e.kind === 'goblin') {
      ctx.fillStyle = flash ? '#ffffff' : '#4d7c0f';
      ctx.beginPath();
      ctx.roundRect(-7, -18, 14, 13, 3);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -23, 6, 0, Math.PI * 2);
      ctx.fill();
      // Pointy ears & glowing eyes
      ctx.beginPath();
      ctx.moveTo(-6, -24);
      ctx.lineTo(-12, -28);
      ctx.lineTo(-5, -21);
      ctx.moveTo(6, -24);
      ctx.lineTo(12, -28);
      ctx.lineTo(5, -21);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-3, -24, 2, 2);
      ctx.fillRect(1, -24, 2, 2);
    } else if (e.kind === 'orc') {
      ctx.fillStyle = flash ? '#ffffff' : isWindup ? '#fb923c' : '#15803d';
      ctx.beginPath();
      ctx.roundRect(-13, -29, 26, 23, 5);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Shoulder pauldrons
      ctx.fillStyle = '#475569';
      ctx.fillRect(-15, -29, 7, 7);
      ctx.fillRect(8, -29, 7, 7);
      ctx.fillStyle = flash ? '#ffffff' : isWindup ? '#fb923c' : '#15803d';
      ctx.beginPath();
      ctx.arc(0, -35, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Tusks
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(-4, -31, 2, 4);
      ctx.fillRect(2, -31, 2, 4);
    } else if (e.kind === 'cultist') {
      ctx.fillStyle = flash ? '#ffffff' : '#6b21a8';
      ctx.beginPath();
      ctx.moveTo(-10, -2);
      ctx.lineTo(0, -28);
      ctx.lineTo(10, -2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = isWindup ? '#fbbf24' : '#ef4444';
      ctx.beginPath();
      ctx.arc(0, -25, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'boss') {
      // Lord Dinglepus! Towering horned monarch with crimson mantle
      ctx.fillStyle = flash ? '#ffffff' : '#7f1d1d';
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(-14, -44);
      ctx.lineTo(14, -44);
      ctx.lineTo(20, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.fillStyle = flash ? '#ffffff' : '#9333ea';
      ctx.beginPath();
      ctx.arc(0, -48, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Golden Horned Crown
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-12, -55);
      ctx.lineTo(-16, -68);
      ctx.lineTo(-5, -58);
      ctx.lineTo(0, -70);
      ctx.lineTo(5, -58);
      ctx.lineTo(16, -68);
      ctx.lineTo(12, -55);
      ctx.closePath();
      ctx.fill();
    }

    // Telegraph exclamation or health bar above damaged enemies
    if (e.isElite && e.state !== 'dying') {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★ CHAMPION', 0, e.kind === 'orc' ? -52 : -42);
    }

    if (e.state === 'windup') {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 14px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, e.kind === 'boss' ? -76 : e.kind === 'orc' ? -62 : -48);
    }

    if (e.hp < e.maxHp && e.state !== 'dying' && e.kind !== 'boss') {
      const bw = 28;
      const bh = 4;
      const by = e.kind === 'orc' ? -48 : -36;
      ctx.fillStyle = '#0e0c0f';
      ctx.fillRect(-bw / 2 - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-bw / 2, by, bw * (e.hp / e.maxHp), bh);
    }

    ctx.restore();
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, proj: Projectile): void {
    const iso = worldToIso(proj.x, proj.y);
    ctx.save();
    ctx.translate(iso.x, iso.y - 12);
    ctx.fillStyle = proj.color;
    ctx.beginPath();
    ctx.arc(0, 0, proj.kind === 'boss_orb' ? 7 : 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  private drawSlashArc(ctx: CanvasRenderingContext2D, s: SlashArcEffect): void {
    const iso = worldToIso(s.x, s.y);
    const alpha = clamp(s.life / s.maxLife, 0, 1);
    ctx.save();
    ctx.translate(iso.x, iso.y - 12);
    ctx.scale(1, 0.52);
    ctx.globalAlpha = alpha * 0.82;
    ctx.beginPath();
    // Convert world angle to isometric screen angle approximately via cos/sin
    const ax = Math.cos(s.angle);
    const ay = Math.sin(s.angle);
    const isoAngle = Math.atan2(ax + ay, ax - ay);
    ctx.arc(0, 0, s.radius * TILE_HALF_W, isoAngle - s.arc * 0.5, isoAngle + s.arc * 0.5);
    ctx.lineWidth = s.comboStep === 2 ? 14 : 9;
    ctx.strokeStyle = s.color;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      const iso = worldToIso(p.x, p.y);
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(iso.x - p.size * 0.5, iso.y - p.z - p.size * 0.5, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    for (const ft of this.floatingTexts) {
      const iso = worldToIso(ft.x, ft.y);
      const alpha = clamp(ft.life / ft.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = `700 ${Math.round(14 * ft.scale)}px "JetBrains Mono", monospace`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0e0c0f';
      ctx.strokeText(ft.text, iso.x, iso.y - ft.z);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, iso.x, iso.y - ft.z);
    }
    ctx.restore();
  }

  private renderMinimap(): void {
    const mm = this.minimapCanvas;
    if (!mm || this.gameState !== 'playing') return;
    const mctx = mm.getContext('2d');
    if (!mctx) return;

    const w = mm.width;
    const h = mm.height;
    mctx.clearRect(0, 0, w, h);

    mctx.fillStyle = 'rgba(14, 12, 15, 0.84)';
    mctx.fillRect(0, 0, w, h);

    const cellW = w / this.floorData.width;
    const cellH = h / this.floorData.height;

    for (let y = 0; y < this.floorData.height; y++) {
      for (let x = 0; x < this.floorData.width; x++) {
        if (!this.floorData.discovered[y][x]) continue;
        const t = this.floorData.tiles[y][x];
        if (t === 'void') continue;
        if (t === 'wall' || t === 'pillar') {
          mctx.fillStyle = '#475569';
        } else if (t === 'portal') {
          mctx.fillStyle = this.floorData.portalOpen ? '#38bdf8' : '#64748b';
        } else {
          mctx.fillStyle = '#1e293b';
        }
        mctx.fillRect(x * cellW, y * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }

    // Discovered enemies
    for (const e of this.floorData.enemies) {
      if (e.state === 'dying') continue;
      const ex = Math.floor(e.x);
      const ey = Math.floor(e.y);
      if (ex >= 0 && ey >= 0 && ex < this.floorData.width && ey < this.floorData.height && this.floorData.discovered[ey][ex]) {
        mctx.fillStyle = e.kind === 'boss' ? '#fbbf24' : '#ef4444';
        mctx.fillRect(e.x * cellW - 1.5, e.y * cellH - 1.5, 3.5, 3.5);
      }
    }

    // Player dot
    mctx.fillStyle = '#4ade80';
    mctx.beginPath();
    mctx.arc(this.px * cellW, this.py * cellH, 3, 0, Math.PI * 2);
    mctx.fill();
  }
}
