/**
 * MiniGameEngine: Renders 8-bit retro arcade games onto a dedicated 2D canvas (240x160)
 * which textures the 3D handheld console in real-time.
 */

import { MiniGameType } from '../types';
import { soundEngine } from '../audio/SoundEngine';

export class MiniGameEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public currentType: MiniGameType = 'flappy';
  public score: number = 0;
  public highScore: number = 0;
  public isGameOver: boolean = false;
  public onActionSuccess?: () => void; // reduces boredom in main game

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

  // Flappy State
  private flappy = {
    y: 80,
    vy: 0,
    gravity: 0.28,
    jump: -4.2,
    pipes: [] as { x: number; top: number; bottom: number; passed: boolean }[],
    pipeTimer: 0,
  };

  // Space Shooter State
  private space = {
    playerX: 120,
    playerSpeed: 3.2,
    bullets: [] as { x: number; y: number }[],
    aliens: [] as { x: number; y: number; vx: number; type: number; alive: boolean }[],
    alienSpawnTimer: 0,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
  };

  // Maze State
  private maze = {
    x: 120,
    y: 80,
    dirX: 0,
    dirY: 0,
    dots: [] as { x: number; y: number; eaten: boolean }[],
    ghosts: [] as { x: number; y: number; vx: number; vy: number; color: string }[],
    powerTimer: 0,
  };

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d')!;
    this.reset();
    this.update(0.016);
  }

  public setGameType(type: MiniGameType) {
    this.currentType = type;
    this.reset();
  }

  public reset() {
    this.isGameOver = false;
    this.score = 0;
    this.frameCount = 0;

    if (this.currentType === 'flappy') {
      this.flappy.y = 80;
      this.flappy.vy = 0;
      this.flappy.pipes = [
        { x: 260, top: 40, bottom: 90, passed: false },
        { x: 380, top: 55, bottom: 105, passed: false },
      ];
      this.flappy.pipeTimer = 0;
    } else if (this.currentType === 'space') {
      this.space.playerX = 120;
      this.space.bullets = [];
      this.space.aliens = [];
      this.space.particles = [];
      this.space.alienSpawnTimer = 0;
      // Initial wave of aliens
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 6; col++) {
          this.space.aliens.push({
            x: 40 + col * 28,
            y: 25 + row * 22,
            vx: 0.8,
            type: row,
            alive: true,
          });
        }
      }
    } else if (this.currentType === 'maze') {
      this.maze.x = 120;
      this.maze.y = 80;
      this.maze.dirX = 0;
      this.maze.dirY = 0;
      this.maze.powerTimer = 0;
      this.maze.dots = [];
      for (let x = 20; x < 225; x += 18) {
        for (let y = 25; y < 145; y += 18) {
          this.maze.dots.push({ x, y, eaten: false });
        }
      }
      this.maze.ghosts = [
        { x: 40, y: 40, vx: 1.2, vy: 0, color: '#ff3366' },
        { x: 200, y: 120, vx: -1.2, vy: 0, color: '#33ccff' },
        { x: 120, y: 130, vx: 0, vy: -1.2, color: '#ffaa00' },
      ];
    }
    this.render();
  }

  public triggerActionA() {
    if (this.isGameOver) {
      this.reset();
      return;
    }

    if (this.currentType === 'flappy') {
      this.flappy.vy = this.flappy.jump;
      soundEngine.playRetroJump();
      this.onActionSuccess?.();
    } else if (this.currentType === 'space') {
      // Fire bullet
      if (this.space.bullets.length < 5) {
        this.space.bullets.push({ x: this.space.playerX, y: 135 });
        soundEngine.playRetroShoot();
        this.onActionSuccess?.();
      }
    }
  }

  public update(dt: number) {
    this.frameCount++;

    if (this.isGameOver) {
      this.render();
      return;
    }

    if (this.currentType === 'flappy') {
      this.updateFlappy();
    } else if (this.currentType === 'space') {
      this.updateSpace();
    } else if (this.currentType === 'maze') {
      this.updateMaze();
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
    }

    this.render();
  }

  // --- FLAPPY MINI-GAME ---
  private updateFlappy() {
    this.flappy.vy += this.flappy.gravity;
    this.flappy.y += this.flappy.vy;

    // Floor and ceiling
    if (this.flappy.y > 146) {
      this.flappy.y = 146;
      this.gameOver();
      return;
    }
    if (this.flappy.y < 8) {
      this.flappy.y = 8;
      this.flappy.vy = 0;
    }

    // Move pipes
    for (const pipe of this.flappy.pipes) {
      pipe.x -= 1.8;

      // Check collision
      const birdX = 50;
      const birdSize = 7;
      if (
        birdX + birdSize > pipe.x &&
        birdX - birdSize < pipe.x + 22
      ) {
        if (this.flappy.y - birdSize < pipe.top || this.flappy.y + birdSize > pipe.bottom) {
          this.gameOver();
          return;
        }
      }

      // Score
      if (!pipe.passed && pipe.x + 22 < birdX) {
        pipe.passed = true;
        this.score += 10;
        soundEngine.playRetroCoin();
        this.onActionSuccess?.();
      }
    }

    // Recycle pipes
    if (this.flappy.pipes.length > 0 && this.flappy.pipes[0].x < -30) {
      this.flappy.pipes.shift();
      const lastX = this.flappy.pipes[this.flappy.pipes.length - 1]?.x || 240;
      const top = 25 + Math.random() * 50;
      const gap = 46;
      this.flappy.pipes.push({
        x: lastX + 120,
        top,
        bottom: top + gap,
        passed: false,
      });
    }
  }

  // --- SPACE SHOOTER MINI-GAME ---
  private updateSpace() {
    // Player movement
    if (this.dpadLeft && this.space.playerX > 14) {
      this.space.playerX -= this.space.playerSpeed;
    }
    if (this.dpadRight && this.space.playerX < this.width - 14) {
      this.space.playerX += this.space.playerSpeed;
    }

    // Bullets
    for (let i = this.space.bullets.length - 1; i >= 0; i--) {
      const b = this.space.bullets[i];
      b.y -= 5;
      if (b.y < -10) {
        this.space.bullets.splice(i, 1);
        continue;
      }

      // Check hit with aliens
      for (const alien of this.space.aliens) {
        if (alien.alive && Math.abs(b.x - alien.x) < 12 && Math.abs(b.y - alien.y) < 10) {
          alien.alive = false;
          this.space.bullets.splice(i, 1);
          this.score += 25;
          soundEngine.playRetroExplosion();
          this.onActionSuccess?.();

          // Spawn explosion particles
          for (let p = 0; p < 8; p++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 2;
            this.space.particles.push({
              x: alien.x,
              y: alien.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 18,
              color: '#ffcc00',
            });
          }
          break;
        }
      }
    }

    // Move aliens
    let changeDir = false;
    for (const alien of this.space.aliens) {
      if (!alien.alive) continue;
      alien.x += alien.vx;
      if (alien.x > this.width - 20 || alien.x < 20) {
        changeDir = true;
      }
    }
    if (changeDir) {
      for (const alien of this.space.aliens) {
        alien.vx *= -1;
        alien.y += 6;
        if (alien.alive && alien.y > 130) {
          this.gameOver();
          return;
        }
      }
    }

    // Respawn wave if all dead
    if (this.space.aliens.every((a) => !a.alive)) {
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 6; col++) {
          this.space.aliens.push({
            x: 40 + col * 28,
            y: 20 + row * 22,
            vx: (Math.random() > 0.5 ? 1 : -1) * 1.1,
            type: Math.floor(Math.random() * 2),
            alive: true,
          });
        }
      }
      this.score += 100;
      soundEngine.playRetroCoin();
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

  // --- MAZE MINI-GAME ---
  private updateMaze() {
    if (this.dpadLeft) {
      this.maze.dirX = -1.8;
      this.maze.dirY = 0;
    } else if (this.dpadRight) {
      this.maze.dirX = 1.8;
      this.maze.dirY = 0;
    } else if (this.dpadUp) {
      this.maze.dirX = 0;
      this.maze.dirY = -1.8;
    } else if (this.dpadDown) {
      this.maze.dirX = 0;
      this.maze.dirY = 1.8;
    }

    this.maze.x += this.maze.dirX;
    this.maze.y += this.maze.dirY;

    // Boundaries
    this.maze.x = Math.max(12, Math.min(this.width - 12, this.maze.x));
    this.maze.y = Math.max(20, Math.min(this.height - 14, this.maze.y));

    // Eat dots
    for (const dot of this.maze.dots) {
      if (!dot.eaten && Math.abs(this.maze.x - dot.x) < 8 && Math.abs(this.maze.y - dot.y) < 8) {
        dot.eaten = true;
        this.score += 5;
        this.onActionSuccess?.();
        if (Math.random() < 0.25) {
          soundEngine.playRetroCoin();
        }
      }
    }

    // Move ghosts
    for (const ghost of this.maze.ghosts) {
      ghost.x += ghost.vx;
      ghost.y += ghost.vy;

      if (ghost.x < 20 || ghost.x > this.width - 20) ghost.vx *= -1;
      if (ghost.y < 25 || ghost.y > this.height - 25) ghost.vy *= -1;

      // Touch ghost
      if (Math.abs(this.maze.x - ghost.x) < 10 && Math.abs(this.maze.y - ghost.y) < 10) {
        this.gameOver();
        return;
      }
    }

    // Reset dots if all eaten
    if (this.maze.dots.every((d) => d.eaten)) {
      this.maze.dots.forEach((d) => (d.eaten = false));
      this.score += 150;
      soundEngine.playRetroCoin();
    }
  }

  private gameOver() {
    this.isGameOver = true;
    soundEngine.playRetroExplosion();
  }

  // --- RENDERING ON CANVAS ---
  private render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Screen background (retro LCD tint)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.currentType === 'flappy') {
      this.renderFlappy(ctx);
    } else if (this.currentType === 'space') {
      this.renderSpace(ctx);
    } else if (this.currentType === 'maze') {
      this.renderMaze(ctx);
    }

    // Top status bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, this.width, 14);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '8px "Press Start 2P", monospace, sans-serif';
    ctx.fillText(`SCORE:${this.score}`, 4, 10);

    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`HI:${this.highScore}`, 165, 10);

    // Scanlines & CRT vignette overlay for retro feel
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let y = 0; y < this.height; y += 2) {
      ctx.fillRect(0, y, this.width, 1);
    }

    if (this.isGameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(20, 45, this.width - 40, 70);

      ctx.fillStyle = '#ef4444';
      ctx.font = '10px "Press Start 2P", monospace, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', this.width / 2, 72);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '7px "Press Start 2P", monospace, sans-serif';
      ctx.fillText('PULSA A / TAP', this.width / 2, 95);
      ctx.textAlign = 'left';
    }
  }

  private renderFlappy(ctx: CanvasRenderingContext2D) {
    // Sky gradient & clouds
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 14, this.width, this.height - 24);

    // Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(60, 40, 14, 0, Math.PI * 2);
    ctx.arc(80, 36, 18, 0, Math.PI * 2);
    ctx.arc(100, 40, 14, 0, Math.PI * 2);
    ctx.fill();

    // Pipes
    for (const pipe of this.flappy.pipes) {
      ctx.fillStyle = '#22c55e';
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 2;

      // Top pipe
      ctx.fillRect(pipe.x, 0, 22, pipe.top);
      ctx.strokeRect(pipe.x, 0, 22, pipe.top);
      ctx.fillRect(pipe.x - 2, pipe.top - 8, 26, 8);
      ctx.strokeRect(pipe.x - 2, pipe.top - 8, 26, 8);

      // Bottom pipe
      ctx.fillRect(pipe.x, pipe.bottom, 22, this.height - pipe.bottom);
      ctx.strokeRect(pipe.x, pipe.bottom, 22, this.height - pipe.bottom);
      ctx.fillRect(pipe.x - 2, pipe.bottom, 26, 8);
      ctx.strokeRect(pipe.x - 2, pipe.bottom, 26, 8);
    }

    // Ground
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(0, this.height - 12, this.width, 12);
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(0, this.height - 12, this.width, 3);

    // Flappy bird
    ctx.save();
    ctx.translate(50, this.flappy.y);
    const rot = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, this.flappy.vy * 0.12));
    ctx.rotate(rot);

    // Body
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.ellipse(-2, Math.sin(this.frameCount * 0.4) * 2, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(3, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(4, -2, 1, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(5, -1);
    ctx.lineTo(10, 1);
    ctx.lineTo(5, 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private renderSpace(ctx: CanvasRenderingContext2D) {
    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 20; i++) {
      const sx = (i * 37 + this.frameCount * 0.5) % this.width;
      const sy = (i * 53) % (this.height - 20) + 16;
      ctx.fillRect(sx, sy, 1.2, 1.2);
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

    // Engine glow
    ctx.fillStyle = '#f97316';
    ctx.fillRect(px - 2, 145, 4, 3 + Math.sin(this.frameCount * 0.8) * 2);

    // Bullets
    ctx.fillStyle = '#fde047';
    for (const b of this.space.bullets) {
      ctx.fillRect(b.x - 1.5, b.y, 3, 7);
    }

    // Aliens
    for (const a of this.space.aliens) {
      if (!a.alive) continue;
      ctx.fillStyle = a.type === 0 ? '#ec4899' : '#a855f7';
      // Retro alien shape
      ctx.fillRect(a.x - 7, a.y - 4, 14, 8);
      ctx.fillRect(a.x - 9, a.y - 2, 18, 4);
      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(a.x - 4, a.y - 2, 2, 2);
      ctx.fillRect(a.x + 2, a.y - 2, 2, 2);
    }

    // Particles
    for (const p of this.space.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
  }

  private renderMaze(ctx: CanvasRenderingContext2D) {
    // Grid dots
    ctx.fillStyle = '#fbbf24';
    for (const dot of this.maze.dots) {
      if (!dot.eaten) {
        ctx.fillRect(dot.x - 1, dot.y - 1, 2.5, 2.5);
      }
    }

    // Player
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(this.maze.x, this.maze.y, 6, 0.2 * Math.PI, 1.8 * Math.PI);
    ctx.lineTo(this.maze.x, this.maze.y);
    ctx.fill();

    // Ghosts
    for (const g of this.maze.ghosts) {
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(g.x, g.y - 2, 6, Math.PI, 0, false);
      ctx.lineTo(g.x + 6, g.y + 6);
      ctx.lineTo(g.x + 2, g.y + 4);
      ctx.lineTo(g.x - 2, g.y + 6);
      ctx.lineTo(g.x - 6, g.y + 4);
      ctx.closePath();
      ctx.fill();

      // Ghost eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(g.x - 4, g.y - 4, 2.5, 2.5);
      ctx.fillRect(g.x + 1.5, g.y - 4, 2.5, 2.5);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(g.x - 3, g.y - 3, 1.5, 1.5);
      ctx.fillRect(g.x + 2.5, g.y - 3, 1.5, 1.5);
    }
  }
}
