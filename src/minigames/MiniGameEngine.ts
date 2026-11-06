/**
 * MiniGameEngine: Dedicated 8-bit Space Invaders game for the handheld console.
 * - Dynamic level variations:
 *   * Level 1: Classic Swarm
 *   * Level 2: V-Formation (Arrowhead)
 *   * Level 3: Armored Mechs (2 HP + Shields)
 *   * Level 4: Split Flanks
 *   * Level 5, 10, 15...: BOSS BATTLE (Giant Mothership with HP Bar & Spread Cannons)
 * - Retains current level on console death (does NOT reset to level 1).
 * - Fast arcade pacing with dynamic acceleration.
 */

import { soundEngine } from '../audio/SoundEngine';

export interface Alien {
  x: number;
  y: number;
  vx: number;
  row: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  color: string;
  isArmored?: boolean;
  isBoss?: boolean;
  scoreValue: number;
  width: number;
  height: number;
}

export class MiniGameEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public score: number = 0;
  public highScore: number = 0;
  public level: number = 1;
  public isGameOver: boolean = false;
  public isPaused: boolean = false;
  public isLevelClear: boolean = false;
  public levelClearTimer: number = 0;
  public levelTitle: string = '';

  public onActionSuccess?: () => void; // reduces boredom
  public onLevelUp?: (level: number) => void;

  // Input state
  public dpadLeft: boolean = false;
  public dpadRight: boolean = false;
  public dpadUp: boolean = false;
  public dpadDown: boolean = false;
  public buttonA: boolean = false;
  public buttonB: boolean = false;

  private width = 240;
  private height = 160;
  private frameCount = 0;

  // Space Shooter State - Balanced retro arcade pacing
  private space = {
    playerX: 120,
    playerSpeed: 4.2,
    bullets: [] as { x: number; y: number }[],
    alienBombs: [] as { x: number; y: number; vx?: number }[],
    aliens: [] as Alien[],
    boss: null as Alien | null,
    totalWaveAliens: 12,
    alienDropTimer: 0,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
  };

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d')!;
    this.reset(true);
    this.update(0.016);
  }

  public setPaused(paused: boolean) {
    if (this.isPaused !== paused) {
      this.isPaused = paused;
      this.render();
    }
  }

  /**
   * Resets the game.
   * @param keepLevel - If true, restarts the CURRENT LEVEL without sending player back to level 1.
   */
  public reset(keepLevel: boolean = true) {
    this.isGameOver = false;
    this.isLevelClear = false;
    this.levelClearTimer = 0;

    if (!keepLevel) {
      this.level = 1;
      this.score = 0;
    }

    this.space.playerX = 120;
    this.space.bullets = [];
    this.space.alienBombs = [];
    this.space.particles = [];
    this.space.alienDropTimer = 0;
    this.space.boss = null;

    this.spawnAlienWave();
    this.render();
  }

  private spawnAlienWave() {
    this.space.aliens = [];
    const isBossLevel = this.level % 5 === 0;

    if (isBossLevel) {
      // --- BOSS LEVEL (Mothership) ---
      this.levelTitle = `JEFE: NODRIZA ${Math.floor(this.level / 5)}`;
      const bossHp = 15 + Math.floor(this.level / 5) * 5;
      const boss: Alien = {
        x: 120,
        y: 35,
        vx: 1.6 + this.level * 0.1,
        row: 0,
        hp: bossHp,
        maxHp: bossHp,
        alive: true,
        color: '#f43f5e',
        isBoss: true,
        scoreValue: 1000,
        width: 44,
        height: 20,
      };
      this.space.boss = boss;
      this.space.aliens.push(boss);
      this.space.totalWaveAliens = 1;

      // Add 2 escort drones
      for (let i = -1; i <= 1; i += 2) {
        this.space.aliens.push({
          x: 120 + i * 45,
          y: 55,
          vx: 1.8,
          row: 1,
          hp: 1,
          maxHp: 1,
          alive: true,
          color: '#38bdf8',
          scoreValue: 40,
          width: 14,
          height: 8,
        });
      }
      this.space.totalWaveAliens = 3;
      return;
    }

    // Determine layout variation based on level
    const variation = (this.level - 1) % 4; // 0, 1, 2, 3
    const baseSpeed = 0.85 + (this.level - 1) * 0.15;

    if (variation === 0) {
      // Variation 1: Classic Grid Formation
      this.levelTitle = `NIVEL ${this.level}: INVASIÓN`;
      const rows = 2;
      const cols = 6;
      this.space.totalWaveAliens = rows * cols;
      const rowColors = ['#f43f5e', '#ec4899'];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          this.space.aliens.push({
            x: 35 + c * 30,
            y: 24 + r * 18,
            vx: baseSpeed,
            row: r,
            hp: 1,
            maxHp: 1,
            alive: true,
            color: rowColors[r % rowColors.length],
            scoreValue: 20,
            width: 14,
            height: 8,
          });
        }
      }
    } else if (variation === 1) {
      // Variation 2: V-Formation (Arrowhead)
      this.levelTitle = `NIVEL ${this.level}: PUNTA DE FLECHA`;
      const vOffsets = [
        { c: 0, r: 0 },
        { c: -1, r: 1 }, { c: 1, r: 1 },
        { c: -2, r: 2 }, { c: 2, r: 2 },
        { c: -3, r: 3 }, { c: 3, r: 3 },
        { c: -1, r: 2 }, { c: 1, r: 2 },
        { c: -2, r: 3 }, { c: 2, r: 3 },
      ];
      this.space.totalWaveAliens = vOffsets.length;

      for (const off of vOffsets) {
        this.space.aliens.push({
          x: 120 + off.c * 24,
          y: 22 + off.r * 15,
          vx: baseSpeed * 1.1,
          row: off.r,
          hp: 1,
          maxHp: 1,
          alive: true,
          color: '#facc15',
          scoreValue: 25,
          width: 14,
          height: 8,
        });
      }
    } else if (variation === 2) {
      // Variation 3: Armored Mechs (Front row has 2 HP with shields!)
      this.levelTitle = `NIVEL ${this.level}: MECHS BLINDADOS`;
      const rows = 3;
      const cols = 5;
      this.space.totalWaveAliens = rows * cols;

      for (let r = 0; r < rows; r++) {
        const isArmored = r === rows - 1; // front row armored
        for (let c = 0; c < cols; c++) {
          this.space.aliens.push({
            x: 45 + c * 34,
            y: 24 + r * 18,
            vx: baseSpeed * 0.95,
            row: r,
            hp: isArmored ? 2 : 1,
            maxHp: isArmored ? 2 : 1,
            alive: true,
            isArmored,
            color: isArmored ? '#38bdf8' : '#a855f7',
            scoreValue: isArmored ? 50 : 25,
            width: isArmored ? 16 : 14,
            height: isArmored ? 10 : 8,
          });
        }
      }
    } else {
      // Variation 4: Split Flanks (Twin Columns)
      this.levelTitle = `NIVEL ${this.level}: FLANCOS DOBLES`;
      this.space.totalWaveAliens = 12;

      // Left squad
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 2; c++) {
          this.space.aliens.push({
            x: 25 + c * 24,
            y: 22 + r * 16,
            vx: baseSpeed * 1.15,
            row: r,
            hp: 1,
            maxHp: 1,
            alive: true,
            color: '#ec4899',
            scoreValue: 30,
            width: 14,
            height: 8,
          });
        }
      }
      // Right squad
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 2; c++) {
          this.space.aliens.push({
            x: 185 + c * 24,
            y: 22 + r * 16,
            vx: -baseSpeed * 1.15,
            row: r,
            hp: 1,
            maxHp: 1,
            alive: true,
            color: '#10b981',
            scoreValue: 30,
            width: 14,
            height: 8,
          });
        }
      }
    }
  }

  public triggerActionA() {
    if (this.isGameOver) {
      // Keep level on restart in the console minigame!
      this.reset(true);
      return;
    }

    if (this.isPaused) return;

    // Fire laser beam with rapid response
    if (this.space.bullets.length < 5) {
      this.space.bullets.push({ x: this.space.playerX, y: 135 });
      soundEngine.playRetroShoot();
      this.onActionSuccess?.();
    }
  }

  public update(dt: number) {
    this.frameCount++;

    if (this.isPaused) {
      this.render();
      return;
    }

    if (this.isGameOver) {
      this.render();
      return;
    }

    // Level Clear Transition
    if (this.isLevelClear) {
      this.levelClearTimer -= dt;
      if (this.levelClearTimer <= 0) {
        this.isLevelClear = false;
        this.level++;
        this.onLevelUp?.(this.level);
        this.reset(true); // advance to next level!
      }
      this.render();
      return;
    }

    this.updateSpace(dt);

    if (this.score > this.highScore) {
      this.highScore = this.score;
    }

    this.render();
  }

  private updateSpace(dt: number) {
    // Player controls
    if (this.dpadLeft && this.space.playerX > 14) {
      this.space.playerX -= this.space.playerSpeed;
    }
    if (this.dpadRight && this.space.playerX < this.width - 14) {
      this.space.playerX += this.space.playerSpeed;
    }

    // Player bullets
    for (let i = this.space.bullets.length - 1; i >= 0; i--) {
      const b = this.space.bullets[i];
      b.y -= 8.5; // Rapid laser travel
      if (b.y < 12) {
        this.space.bullets.splice(i, 1);
        continue;
      }

      // Hit aliens
      for (const alien of this.space.aliens) {
        if (
          alien.alive &&
          Math.abs(b.x - alien.x) < alien.width / 2 + 3 &&
          Math.abs(b.y - alien.y) < alien.height / 2 + 4
        ) {
          alien.hp--;
          this.space.bullets.splice(i, 1);

          if (alien.hp <= 0) {
            alien.alive = false;
            this.score += alien.scoreValue;
            soundEngine.playRetroExplosion();
            this.onActionSuccess?.();

            // Big particles for boss, normal for aliens
            const count = alien.isBoss ? 24 : 8;
            for (let p = 0; p < count; p++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = 1.2 + Math.random() * 3.2;
              this.space.particles.push({
                x: alien.x,
                y: alien.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: alien.isBoss ? 24 : 14,
                color: alien.color,
              });
            }
          } else {
            // Damaged but still alive (Armored or Boss)
            soundEngine.triggerHaptic(15);
            this.score += 10;
            this.onActionSuccess?.();
          }
          break;
        }
      }
    }

    // Check living aliens count
    let changeDir = false;
    let livingAliensCount = 0;

    for (const alien of this.space.aliens) {
      if (alien.alive) livingAliensCount++;
    }

    // Check Victory / Wave cleared!
    if (livingAliensCount === 0 && !this.isLevelClear) {
      this.isLevelClear = true;
      this.levelClearTimer = 1.4;
      this.score += 250 * this.level;
      soundEngine.playRetroCoin();
      return;
    }

    // Dynamic speed boost multiplier when fewer aliens remain (moderated for playable pacing)
    const speedBoost = 1.0 + (1 - livingAliensCount / Math.max(1, this.space.totalWaveAliens)) * 0.45;

    for (const alien of this.space.aliens) {
      if (!alien.alive) continue;
      alien.x += alien.vx * speedBoost;
      if (alien.x > this.width - alien.width / 2 - 4 || alien.x < alien.width / 2 + 4) {
        changeDir = true;
      }
    }

    // Bounce and step downwards (smaller drop step so aliens descend gently)
    if (changeDir) {
      const dropAmount = this.space.boss ? 1.5 : 3;
      for (const alien of this.space.aliens) {
        alien.vx *= -1;
        alien.y += dropAmount;
        if (alien.alive && alien.y > 132) {
          // Reached player level: Game over in minigame
          this.isGameOver = true;
          soundEngine.playRetroExplosion();
          return;
        }
      }
    }

    // Alien bombs / Boss triple cannons (relaxed interval)
    this.space.alienDropTimer += dt;
    const isBoss = !!this.space.boss?.alive;
    const bombInterval = isBoss ? 1.0 : Math.max(0.7, 2.2 - this.level * 0.15);

    if (this.space.alienDropTimer > bombInterval) {
      this.space.alienDropTimer = 0;
      if (isBoss && this.space.boss) {
        // Boss fires 3 spread orbs!
        this.space.alienBombs.push({ x: this.space.boss.x - 12, y: this.space.boss.y + 10, vx: -0.5 });
        this.space.alienBombs.push({ x: this.space.boss.x, y: this.space.boss.y + 12, vx: 0 });
        this.space.alienBombs.push({ x: this.space.boss.x + 12, y: this.space.boss.y + 10, vx: 0.5 });
      } else {
        const aliveAliens = this.space.aliens.filter((a) => a.alive);
        if (aliveAliens.length > 0) {
          const shooter = aliveAliens[Math.floor(Math.random() * aliveAliens.length)];
          this.space.alienBombs.push({ x: shooter.x, y: shooter.y + 6, vx: 0 });
        }
      }
    }

    // Update alien bombs (gentler projectile speed)
    for (let i = this.space.alienBombs.length - 1; i >= 0; i--) {
      const bomb = this.space.alienBombs[i];
      bomb.y += 2.2 + this.level * 0.15;
      if (bomb.vx) bomb.x += bomb.vx;

      if (bomb.y > this.height || bomb.x < 0 || bomb.x > this.width) {
        this.space.alienBombs.splice(i, 1);
        continue;
      }

      // Check hit with player
      if (Math.abs(bomb.x - this.space.playerX) < 10 && Math.abs(bomb.y - 140) < 8) {
        this.isGameOver = true;
        soundEngine.playRetroExplosion();
        return;
      }
    }

    // Update particles
    for (let i = this.space.particles.length - 1; i >= 0; i--) {
      const p = this.space.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        this.space.particles.splice(i, 1);
      }
    }
  }

  // --- RENDERING CANVAS ---
  private render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Deep space background
    ctx.fillStyle = '#060a17';
    ctx.fillRect(0, 0, this.width, this.height);

    // Starfield
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 24; i++) {
      const sx = (i * 41 + (this.isPaused ? 0 : this.frameCount * 0.3)) % this.width;
      const sy = (i * 59) % (this.height - 20) + 16;
      ctx.fillRect(sx, sy, 1.2, 1.2);
    }

    // Top status bar: Level & Score
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, this.width, 14);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '8px "Press Start 2P", monospace, sans-serif';
    ctx.fillText(`LVL:${this.level}`, 4, 10);

    ctx.fillStyle = '#fde047';
    ctx.fillText(`PTS:${this.score}`, 70, 10);

    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`HI:${this.highScore}`, 165, 10);

    // Boss Health Bar (if active)
    if (this.space.boss && this.space.boss.alive) {
      const b = this.space.boss;
      const barW = 100;
      const barH = 4;
      const bx = (this.width - barW) / 2;
      const by = 16;
      ctx.fillStyle = '#334155';
      ctx.fillRect(bx, by, barW, barH);
      const fillW = Math.max(0, (b.hp / b.maxHp) * barW);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(bx, by, fillW, barH);

      ctx.fillStyle = '#f87171';
      ctx.font = '6px "Press Start 2P", monospace, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`JEFE HP: ${b.hp}/${b.maxHp}`, this.width / 2, 26);
      ctx.textAlign = 'left';
    }

    // Player ship
    const px = this.space.playerX;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(px, 134);
    ctx.lineTo(px - 10, 148);
    ctx.lineTo(px, 144);
    ctx.lineTo(px + 10, 148);
    ctx.closePath();
    ctx.fill();

    // Engine thruster glow
    ctx.fillStyle = '#f97316';
    const thruster = this.isPaused ? 3 : 3 + Math.sin(this.frameCount * 0.8) * 2;
    ctx.fillRect(px - 2, 145, 4, thruster);

    // Player bullets
    ctx.fillStyle = '#38bdf8';
    for (const b of this.space.bullets) {
      ctx.fillRect(b.x - 1.5, b.y, 3, 7);
    }

    // Alien bombs
    ctx.fillStyle = '#ef4444';
    for (const bomb of this.space.alienBombs) {
      ctx.beginPath();
      ctx.arc(bomb.x, bomb.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Aliens & Boss Rendering
    for (const a of this.space.aliens) {
      if (!a.alive) continue;

      if (a.isBoss) {
        // --- BOSS MOTHERSHIP ---
        ctx.fillStyle = a.color;
        // Central massive hull
        ctx.fillRect(a.x - 22, a.y - 8, 44, 16);
        ctx.fillRect(a.x - 14, a.y - 12, 28, 4);
        ctx.fillRect(a.x - 8, a.y + 8, 16, 4);
        // Wings
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(a.x - 26, a.y - 4, 6, 8);
        ctx.fillRect(a.x + 20, a.y - 4, 6, 8);
        // Glowing Core
        ctx.fillStyle = '#fde047';
        ctx.fillRect(a.x - 4, a.y - 2, 8, 6);
      } else if (a.isArmored) {
        // --- ARMORED MECH ---
        ctx.fillStyle = a.color;
        ctx.fillRect(a.x - 8, a.y - 5, 16, 10);
        // Shield outline
        ctx.strokeStyle = a.hp > 1 ? '#67e8f9' : '#f97316';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(a.x - 9, a.y - 6, 18, 12);
        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(a.x - 4, a.y - 2, 2, 2);
        ctx.fillRect(a.x + 2, a.y - 2, 2, 2);
      } else {
        // --- STANDARD INVADER ---
        ctx.fillStyle = a.color;
        ctx.fillRect(a.x - 7, a.y - 4, 14, 8);
        ctx.fillRect(a.x - 9, a.y - 2, 18, 4);
        // Antennae & claws
        ctx.fillRect(a.x - 6, a.y - 6, 2, 2);
        ctx.fillRect(a.x + 4, a.y - 6, 2, 2);
        ctx.fillRect(a.x - 8, a.y + 4, 3, 2);
        ctx.fillRect(a.x + 5, a.y + 4, 3, 2);
        // White eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(a.x - 4, a.y - 2, 2, 2);
        ctx.fillRect(a.x + 2, a.y - 2, 2, 2);
      }
    }

    // Particles
    for (const p of this.space.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }

    // Scanlines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let y = 0; y < this.height; y += 2) {
      ctx.fillRect(0, y, this.width, 1);
    }

    // --- PAUSE OVERLAY ---
    if (this.isPaused && !this.isGameOver && !this.isLevelClear) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(30, 55, this.width - 60, 45);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(30, 55, this.width - 60, 45);

      ctx.fillStyle = '#fde047';
      ctx.font = '10px "Press Start 2P", monospace, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('[ PAUSA ]', this.width / 2, 75);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '6px "Press Start 2P", monospace, sans-serif';
      ctx.fillText('MIRA ABAJO PARA REANUDAR', this.width / 2, 90);
      ctx.textAlign = 'left';
    }

    // --- LEVEL CLEAR BANNER ---
    if (this.isLevelClear) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(20, 50, this.width - 40, 55);

      ctx.fillStyle = '#4ade80';
      ctx.font = '9px "Press Start 2P", monospace, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('¡NIVEL SUPERADO!', this.width / 2, 70);

      ctx.fillStyle = '#fde047';
      ctx.font = '7px "Press Start 2P", monospace, sans-serif';
      ctx.fillText(`SIGUIENTE: NIVEL ${this.level + 1}`, this.width / 2, 90);
      ctx.textAlign = 'left';
    }

    // --- GAME OVER IN CONSOLE BANNER ---
    if (this.isGameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(20, 45, this.width - 40, 68);

      ctx.fillStyle = '#ef4444';
      ctx.font = '10px "Press Start 2P", monospace, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NAVE DESTRUIDA', this.width / 2, 68);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '7px "Press Start 2P", monospace, sans-serif';
      ctx.fillText(`REINTENTAR NIVEL ${this.level}`, this.width / 2, 85);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '6px "Press Start 2P", monospace, sans-serif';
      ctx.fillText('PULSA A / TAP', this.width / 2, 99);
      ctx.textAlign = 'left';
    }
  }
}
