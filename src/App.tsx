/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameState, GameMode, MonsterLocation, ActiveMonster, SensorStatus, GameStats } from './types';
import { soundEngine } from './audio/SoundEngine';
import { MiniGameEngine } from './minigames/MiniGameEngine';
import { RoomScene } from './three/RoomScene';
import { HUD } from './components/HUD';
import { ConsoleControls } from './components/ConsoleControls';
import { PermissionsModal } from './components/PermissionsModal';
import { VictoryModal } from './components/VictoryModal';
import { RotatePrompt } from './components/RotatePrompt';
import { EyelidsOverlay } from './components/EyelidsOverlay';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);

  // Core engines
  const sceneRef = useRef<RoomScene | null>(null);
  const miniGameRef = useRef<MiniGameEngine | null>(null);

  // Game state
  const [gameState, setGameState] = useState<GameState>('intro');
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;
  const [boredom, setBoredom] = useState<number>(15);
  const [isSleeping, setIsSleeping] = useState<boolean>(false);
  const [lookingAtConsole, setLookingAtConsole] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Time & stats
  const [stats, setStats] = useState<GameStats>(() => {
    const savedBest =
      typeof window !== 'undefined'
        ? parseInt(localStorage.getItem('desvelada_infinite_highscore') || '0', 10) || 0
        : 0;
    return {
      score: 0,
      level: 1,
      monstersRepelled: 0,
      timeSurvivedMinutes: 0,
      currentHour: 0, // 0 = 12 AM
      gameTimeSeconds: 0,
      mode: 'classic',
      highScore: savedBest,
    };
  });

  const modeRef = useRef<GameMode>('classic');

  // Sensor states (tactile only, gyroscope removed)
  const [sensorStatus] = useState<SensorStatus>({
    hapticsSupported: typeof navigator !== 'undefined' && 'vibrate' in navigator,
  });

  const [cucoInBeam, setCucoInBeam] = useState<boolean>(false);
  const [lossNotice, setLossNotice] = useState<'cuco' | 'sleep' | null>(null);

  // Camera orientation angles (Euler radians)
  const cameraYaw = useRef<number>(0);
  const cameraPitch = useRef<number>(-0.45); // start looking down at console
  const targetYaw = useRef<number>(0);
  const targetPitch = useRef<number>(-0.45);

  // Monster tracking (Pool of active monsters for classic and infinite modes)
  const monstersRef = useRef<ActiveMonster[]>([]);
  const attackingMonsterId = useRef<string | null>(null);
  const cucoSpawnCountdown = useRef<number>(3.5); // First Cuco appears in ~3.5 seconds!
  const jumpscareTimer = useRef<number>(0);
  const [showGameOver, setShowGameOver] = useState<boolean>(false);

  // Drag interaction
  const isDragging = useRef<boolean>(false);
  const lastTouchX = useRef<number>(0);
  const lastTouchY = useRef<number>(0);

  // --- INITIALIZE ENGINES ON MOUNT ---
  useEffect(() => {
    if (!mountRef.current) return;

    const miniGame = new MiniGameEngine();
    miniGameRef.current = miniGame;

    // Reduce boredom on alien hit
    miniGame.onActionSuccess = () => {
      setBoredom((prev) => Math.max(0, prev - 4.0));
      setStats((prev) => {
        const nextScore = miniGame.score;
        const nextHigh = Math.max(prev.highScore, nextScore);
        if (prev.mode === 'infinite' && nextScore > prev.highScore) {
          localStorage.setItem('desvelada_infinite_highscore', String(nextScore));
        }
        return { ...prev, score: nextScore, highScore: nextHigh };
      });
    };

    // Level up reward
    miniGame.onLevelUp = (newLevel) => {
      setBoredom((prev) => Math.max(0, prev - 22)); // big adrenaline rush on level clear!
      setStats((prev) => {
        const nextScore = miniGame.score;
        const nextHigh = Math.max(prev.highScore, nextScore);
        if (prev.mode === 'infinite' && nextScore > prev.highScore) {
          localStorage.setItem('desvelada_infinite_highscore', String(nextScore));
        }
        return { ...prev, level: newLevel, score: nextScore, highScore: nextHigh };
      });
    };

    const roomScene = new RoomScene(mountRef.current, miniGame);
    sceneRef.current = roomScene;

    const onResize = () => roomScene.handleResize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      roomScene.dispose();
      soundEngine.dispose();
    };
  }, []);

  // Start menu ambient music on initial user interaction with the intro screen
  useEffect(() => {
    const handleFirstGesture = () => {
      soundEngine.init();
      if (gameStateRef.current === 'intro' && !soundEngine.isGameOverPlaying()) {
        soundEngine.playAmbienteMusic();
      }
    };
    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, []);

  // --- START GAME (Touch only) ---
  const handleStartGame = (options: { mode: GameMode }) => {
    soundEngine.init();
    soundEngine.stopGameOverMusic();
    soundEngine.stopAmbienteMusic();
    setLossNotice(null);
    modeRef.current = options.mode;
    setStats((prev) => ({ ...prev, mode: options.mode }));
    setBoredom(15);
    setIsSleeping(false);
    setLookingAtConsole(true);
    targetPitch.current = -0.45;
    targetYaw.current = 0;
    monstersRef.current = [];
    attackingMonsterId.current = null;
    cucoSpawnCountdown.current = 3.5;
    jumpscareTimer.current = 0;
    setShowGameOver(false);
    sceneRef.current?.hideAllCucos();
    miniGameRef.current?.reset(false);
    // Player starts looking at console, play console track
    soundEngine.playConsolaMusic();
    setGameState('playing');
  };

  // Toggle Mute
  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    soundEngine.setMuted(nextMute);
  };

  // Toggle Look (Console vs Room)
  const toggleLook = useCallback(() => {
    if (lookingAtConsole) {
      targetPitch.current = 0.05; // look forward at room
      setLookingAtConsole(false);
    } else {
      targetPitch.current = -0.45; // look down at console
      setLookingAtConsole(true);
    }
  }, [lookingAtConsole]);

  // Feign Sleep actions ("HACERSE EL DORMIDO")
  // USER REQUIREMENTS:
  // 1. Al jugar en la consola NO te podés hacer el dormido
  // 2. Para hacerte el dormido tenés que apuntar al Cuco con la linterna (verlo)
  const startSleeping = useCallback(() => {
    if (gameState !== 'playing') return;
    if (lookingAtConsole) return;
    if (!sceneRef.current?.isCucoInFlashlightBeam) return;

    setIsSleeping(true);
    soundEngine.playFeignSleep();
  }, [gameState, lookingAtConsole]);

  const endSleeping = useCallback(() => {
    setIsSleeping(false);
  }, []);

  // Keyboard navigation & controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      if (e.repeat) return;
      if (e.code === 'KeyC') toggleLook();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyZ') {
        startSleeping();
      }

      // Minigame inputs
      const mini = miniGameRef.current;
      if (!mini) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') mini.dpadUp = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') mini.dpadDown = true;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') mini.dpadLeft = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') mini.dpadRight = true;
      if (e.code === 'Space' || e.code === 'KeyJ') {
        mini.triggerActionA();
      }
      if (e.code === 'KeyK' || e.code === 'KeyR') {
        mini.reset(false);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyZ') {
        endSleeping();
      }
      const mini = miniGameRef.current;
      if (!mini) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') mini.dpadUp = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') mini.dpadDown = false;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') mini.dpadLeft = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') mini.dpadRight = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gameState, toggleLook, startSleeping, endSleeping]);

  // Touch / Pointer Drag for room rotation
  const handlePointerDown = (e: React.PointerEvent) => {
    if (gameState !== 'playing') return;
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    isDragging.current = true;
    lastTouchX.current = e.clientX;
    lastTouchY.current = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (gameState !== 'playing' || !isDragging.current) return;
    const deltaX = e.clientX - lastTouchX.current;
    const deltaY = e.clientY - lastTouchY.current;
    lastTouchX.current = e.clientX;
    lastTouchY.current = e.clientY;

    const sensitivity = 0.0035;
    // USER REQUIREMENT: Impedir al jugador ver los bordes o parte negra de la imagen
    // Clamped strictly to [-1.10, 1.10] radians (~ -63° to +63°) and pitch to [-0.55, 0.35]
    targetYaw.current = Math.max(-1.10, Math.min(1.10, targetYaw.current - deltaX * sensitivity));
    targetPitch.current = Math.max(-0.55, Math.min(0.35, targetPitch.current - deltaY * sensitivity));
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  // Restart game after GameOver
  const handleRestart = () => {
    soundEngine.stopGameOverMusic();
    soundEngine.stopAmbienteMusic();
    setBoredom(15);
    setIsSleeping(false);
    setLookingAtConsole(true);
    targetPitch.current = -0.45;
    targetYaw.current = 0;
    monstersRef.current = [];
    attackingMonsterId.current = null;
    cucoSpawnCountdown.current = 3.5;
    jumpscareTimer.current = 0;
    setShowGameOver(false);
    sceneRef.current?.hideAllCucos();

    // Preserve the level achieved in Space Invaders!
    const currentLevel = stats.level;
    miniGameRef.current?.reset(true);

    const savedBest =
      typeof window !== 'undefined'
        ? parseInt(localStorage.getItem('desvelada_infinite_highscore') || '0', 10) || 0
        : 0;

    setStats({
      score: 0,
      level: currentLevel,
      monstersRepelled: 0,
      timeSurvivedMinutes: 0,
      currentHour: 0,
      gameTimeSeconds: 0,
      mode: stats.mode,
      highScore: savedBest,
    });
    soundEngine.playConsolaMusic();
    setGameState('playing');
  };

  // Return to Initial Start Menu & Reset all game states
  const handleMainMenu = () => {
    soundEngine.stopConsolaMusic();
    // USER REQUIREMENT: "ambiente.mp3" sea la canción del menú, y evitar que se reproduzca al mismo tiempo que game over.mp3
    if (!soundEngine.isGameOverPlaying()) {
      soundEngine.playAmbienteMusic();
    }
    setBoredom(15);
    setIsSleeping(false);
    setLookingAtConsole(true);
    targetPitch.current = -0.45;
    targetYaw.current = 0;
    monstersRef.current = [];
    attackingMonsterId.current = null;
    cucoSpawnCountdown.current = 3.5;
    jumpscareTimer.current = 0;
    setShowGameOver(false);
    sceneRef.current?.hideAllCucos();
    miniGameRef.current?.reset(false);
    setGameState('intro');
  };

  // --- MAIN RENDER & GAME LOOP (requestAnimationFrame) ---
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();
    let clockTickTimer = 0;

    // Rich varied spawn spots in the large panoramic bedroom
    const classicSpots: MonsterLocation[] = [
      'wardrobe',
      'flowerchest',
      'trainshelf',
      'beanbag',
      'arttable',
      'shuttercloset',
      'footbed',
    ];
    const infiniteSpots: MonsterLocation[] = [
      'wardrobe',
      'flowerchest',
      'trainshelf',
      'ventriloquist',
      'beanbag',
      'arttable',
      'eyeballmobile',
      'shuttercloset',
      'toychair',
      'footbed',
      'underbed',
      'ceiling',
    ];

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const scene = sceneRef.current;
      const miniGame = miniGameRef.current;

      if (scene && miniGame) {
        // 1. Smooth Camera rotation with exponential damping
        cameraYaw.current = THREE.MathUtils.damp(cameraYaw.current, targetYaw.current, 10, dt);
        cameraPitch.current = THREE.MathUtils.damp(cameraPitch.current, targetPitch.current, 10, dt);

        scene.camera.rotation.order = 'YXZ';
        scene.camera.rotation.y = cameraYaw.current;
        scene.camera.rotation.x = cameraPitch.current;

        // Auto-detect if player is looking at console (pitch < -0.22)
        const isLookingDown = cameraPitch.current < -0.22;
        setLookingAtConsole(isLookingDown);

        // USER REQUIREMENT: Audio management:
        // When playing on console, play "consola.mp3".
        // In the room, "ambiente.mp3" is REMOVED from the room entirely!
        if (gameState === 'playing') {
          if (isLookingDown) {
            soundEngine.playConsolaMusic();
          } else {
            // "eliminala de la habitacion"
            soundEngine.stopConsolaMusic();
            soundEngine.stopAmbienteMusic();
          }
        }

        // PAUSE / RESUME MINIGAME:
        // When looking down, minigame runs active!
        // When looking up at the room OR feigning sleep, minigame pauses immediately!
        if (isLookingDown && !isSleeping && gameState === 'playing') {
          miniGame.setPaused(false);
          miniGame.update(dt);
        } else {
          miniGame.setPaused(true);
        }

        // 2. State specific updates
        if (gameState === 'playing') {
          // --- Clock & Night Progression ---
          clockTickTimer += dt;
          if (clockTickTimer >= 1.0) {
            clockTickTimer = 0;
            soundEngine.playClockTick();
            setStats((prev) => {
              const newSeconds = prev.gameTimeSeconds + 1;
              const hour = Math.floor(newSeconds / 40);
              const hourDisplay = hour === 0 ? '12:00 AM' : `${hour}:00 AM`;
              scene.updateClockDisplay(hourDisplay);

              // Check 6:00 AM Dawn victory ONLY in classic mode!
              // In infinite mode, the night never ends!
              if (prev.mode === 'classic' && hour >= 6) {
                soundEngine.stopAmbienteMusic();
                soundEngine.stopConsolaMusic();
                soundEngine.playVictoryFanfare();
                setGameState('victory');
              }

              return {
                ...prev,
                gameTimeSeconds: newSeconds,
                currentHour: hour,
              };
            });
          }

          // --- Boredom / Sleep Meter Logic ---
          // USER REQUIREMENT: Sleep meter takes 10 SECONDS without playing to reach 100%!
          // When feigning sleep (eyes closed), it continues advancing a bit SLOWER than normal speed (~14s to reach 100%):
          if (isSleeping) {
            setBoredom((prev) => {
              const next = prev + (100 / 14.0) * dt;
              if (next >= 100) {
                soundEngine.playSleepFall();
                soundEngine.playGameOverMusic(() => {
                  if (gameStateRef.current === 'intro') {
                    soundEngine.playAmbienteMusic();
                  }
                });
                setLossNotice('sleep');
                handleMainMenu();
                return 15;
              }
              return next;
            });
          } else if (isLookingDown) {
            // Looking down and actively playing: drains boredom rapidly so you stay wide awake!
            setBoredom((prev) => Math.max(0, prev - 45.0 * dt));
          } else {
            // NOT playing on the console (looking around the dark room):
            // Exactly 10 seconds without playing reaches 100% and you fall asleep!
            setBoredom((prev) => {
              const next = prev + (100 / 10.0) * dt;
              if (next >= 100) {
                soundEngine.playSleepFall();
                soundEngine.playGameOverMusic(() => {
                  if (gameStateRef.current === 'intro') {
                    soundEngine.playAmbienteMusic();
                  }
                });
                setLossNotice('sleep');
                handleMainMenu();
                return 15;
              }
              return next;
            });
          }

          // --- CUCO MONSTER SPAWN & AI LOGIC ---
          const isInfinite = modeRef.current === 'infinite';
          const maxMonsters = isInfinite ? Math.min(3, 2 + Math.floor(stats.gameTimeSeconds / 80)) : 1;
          const availableSpotsPool = isInfinite ? infiniteSpots : classicSpots;

          cucoSpawnCountdown.current -= dt;

          if (cucoSpawnCountdown.current <= 0 && monstersRef.current.length < maxMonsters) {
            // Find spots currently unoccupied
            const occupied = new Set(monstersRef.current.map((m) => m.location));
            const freeSpots = availableSpotsPool.filter((s) => !occupied.has(s));

            if (freeSpots.length > 0) {
              const chosen = freeSpots[Math.floor(Math.random() * freeSpots.length)];
              const newId = `cuco_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
              const attackTimer = isInfinite ? (4.5 + Math.random() * 1.0) : 5.5;

              const monster: ActiveMonster = {
                id: newId,
                location: chosen,
                timer: attackTimer,
                maxTimer: attackTimer,
                spotted: false,
                isAttacking: false,
                attackProgress: 0,
              };

              monstersRef.current.push(monster);
              scene.spawnCuco(chosen, newId);
              // Subtle faint warning cue when Cuco enters
              soundEngine.playCucoSpawnWarning();
            }

            // High spawn frequency, approximately every 5-10 seconds!
            cucoSpawnCountdown.current = isInfinite
              ? (4.0 + Math.random() * 4.0) // 4 to 8s
              : (5.0 + Math.random() * 5.0); // 5 to 10s!
          }

          // Process all active monsters
          if (monstersRef.current.length > 0) {
            if (isSleeping) {
              // Player is pretending to sleep with blanket:
              // All active monsters are deceived and their timers tick down rapidly!
              for (let i = monstersRef.current.length - 1; i >= 0; i--) {
                const m = monstersRef.current[i];
                m.timer -= dt * 2.2;
                if (m.timer <= 1.0) {
                  // Cuco is fooled and silently retreats into the shadows!
                  scene.hideCuco(m.id);
                  soundEngine.playMonsterRetreat();
                  monstersRef.current.splice(i, 1);
                  setStats((prev) => ({
                    ...prev,
                    monstersRepelled: prev.monstersRepelled + 1,
                  }));
                }
              }
            } else {
              // Player is not sleeping: timers count down towards attacks
              for (const m of monstersRef.current) {
                m.timer -= dt;
                if (m.timer <= 0 && !m.isAttacking) {
                  // JUMPSCARE ATTACK TRIGGERED!
                  m.isAttacking = true;
                  attackingMonsterId.current = m.id;
                  jumpscareTimer.current = 0;
                  setGameState('jumpscare');
                  setShowGameOver(false);

                  // Instantly snap player's view straight towards the attacking Cuco!
                  targetPitch.current = 0.05;
                  setLookingAtConsole(false);
                  const loc = RoomScene.LOCATIONS[m.location];
                  if (loc) {
                    targetYaw.current = -Math.atan2(loc.pos[0], -loc.pos[2]);
                  }

                  // Stop gameplay audio immediately on jump
                  soundEngine.stopAmbienteMusic();
                  soundEngine.stopConsolaMusic();
                  soundEngine.playJumpscare();
                  soundEngine.triggerHaptic([100, 50, 150, 50, 250]);
                  break;
                }
              }
            }
          }
        } else if (gameState === 'jumpscare') {
          // Play out 1.2 seconds of visceral terrifying jumpscare!
          jumpscareTimer.current += dt;
          const progress = Math.min(1.0, jumpscareTimer.current / 1.2);

          const attacker =
            monstersRef.current.find((m) => m.id === attackingMonsterId.current) ||
            monstersRef.current[0];
          if (attacker) {
            attacker.attackProgress = progress;
            scene.updateJumpscare(progress, attacker.id);
          }

          // Violent screen shake during jumpscare
          cameraYaw.current += (Math.random() - 0.5) * 0.06;
          cameraPitch.current += (Math.random() - 0.5) * 0.06;

          // USER REQUIREMENT: Al perder por ataque de Cuco, se reproduce "game over.mp3" una única vez,
          // el resto de mp3s dejan de sonar, devolve al jugador al menú principal y reinicia todos los estados del juego!
          // Cuando game over.mp3 termine, se reproduce la canción del menú (ambiente.mp3).
          if (jumpscareTimer.current >= 1.2) {
            soundEngine.playGameOverMusic(() => {
              if (gameStateRef.current === 'intro') {
                soundEngine.playAmbienteMusic();
              }
            });
            setLossNotice('cuco');
            handleMainMenu();
          }
        }

        // 3. Update Scene & Handheld Console
        scene.update(dt, isLookingDown, cameraPitch.current);
        // Track whether player is aiming flashlight at Cuco in the dark room
        setCucoInBeam(scene.isCucoInFlashlightBeam && !isLookingDown);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, isSleeping]);

  const timeString =
    stats.currentHour === 0 ? '12:00 AM' : `${stats.currentHour}:00 AM`;

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Mobile / Tablet Landscape Orientation Prompt */}
      <RotatePrompt />

      {/* Three.js Canvas Mount Container */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />

      {/* --- SMALLER FLASHLIGHT RADIUS & MUCH DARKER ROOM VIGNETTE --- */}
      {!lookingAtConsole && !isSleeping && gameState === 'playing' && (
        <div
          className="pointer-events-none fixed inset-0 z-10 transition-opacity duration-300"
          style={{
            background:
              'radial-gradient(circle at center, rgba(255, 245, 225, 0.03) 0%, rgba(255, 240, 210, 0.01) 6%, rgba(0, 0, 0, 0.78) 16%, rgba(0, 0, 0, 0.98) 28%, #000000 45%)',
          }}
        />
      )}

      {/* --- RETRO CRT STATIC / FILM GRAIN SCREEN OVERLAY (active only when looking at console) --- */}
      {lookingAtConsole && gameState === 'playing' && (
        <div
          className="pointer-events-none fixed inset-0 z-10 opacity-30 mix-blend-overlay"
          style={{
            background:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 2px)',
          }}
        />
      )}

      {/* --- ANIMATION OF EYELIDS CLOSING ("Hacerse el dormido") --- */}
      <EyelidsOverlay isSleeping={isSleeping} />

      {/* --- HIGH BOREDOM / SLEEPY EYELID VIGNETTE --- */}
      {boredom > 60 && !isSleeping && gameState === 'playing' && (
        <div
          className="pointer-events-none fixed inset-0 z-20 transition-opacity duration-500"
          style={{
            background: `radial-gradient(ellipse at center, transparent 35%, rgba(5, 2, 10, ${
              (boredom - 60) / 45
            }) 100%)`,
          }}
        />
      )}

      {/* --- HUD OVERLAY --- */}
      {gameState === 'playing' && (
        <>
          <HUD
            boredom={boredom}
            timeString={timeString}
            gameTimeSeconds={stats.gameTimeSeconds}
            level={stats.level}
            mode={stats.mode}
            lookingAtConsole={lookingAtConsole}
            cucoInBeam={cucoInBeam}
            isSleeping={isSleeping}
            onSleepStart={startSleeping}
            onSleepEnd={endSleeping}
            onToggleLook={toggleLook}
            sensorStatus={sensorStatus}
            isMuted={isMuted}
            onToggleMute={toggleMute}
          />

          <ConsoleControls
            visible={lookingAtConsole}
            onDpadChange={(dir) => {
              const mini = miniGameRef.current;
              if (mini) {
                mini.dpadUp = dir.up;
                mini.dpadDown = dir.down;
                mini.dpadLeft = dir.left;
                mini.dpadRight = dir.right;
              }
            }}
            onButtonAPress={() => miniGameRef.current?.triggerActionA()}
            onButtonBPress={() => miniGameRef.current?.reset(true)}
          />
        </>
      )}

      {/* --- WELCOME & PERMISSIONS MODAL (with Defeat Banner on Return) --- */}
      {gameState === 'intro' && (
        <PermissionsModal
          onStartGame={handleStartGame}
          sensorStatus={sensorStatus}
          lossNotice={lossNotice}
          lastStats={stats}
        />
      )}

      {/* --- TERRIFYING VISCERAL JUMPSCARE OVERLAY --- */}
      {gameState === 'jumpscare' && !showGameOver && (
        <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden select-none">
          {/* Intense flashing red blood vignette */}
          <div
            className="absolute inset-0 animate-pulse"
            style={{
              background:
                'radial-gradient(circle at center, rgba(239, 68, 68, 0.35) 0%, rgba(185, 28, 28, 0.8) 60%, rgba(69, 10, 10, 0.98) 100%)',
            }}
          />
          {/* Glitch text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            <div className="font-pixel text-2xl sm:text-4xl text-red-500 tracking-widest drop-shadow-[0_0_25px_rgba(255,0,0,1)] animate-bounce">
              ¡EL CUCO TE ATRAPÓ!
            </div>
            <div className="mt-2 font-pixel text-xs text-red-200 tracking-wider">
              EL MONSTRUO SE LANZÓ SOBRE TI
            </div>
          </div>
        </div>
      )}

      {/* --- VICTORY 6 AM SCREEN --- */}
      {gameState === 'victory' && (
        <VictoryModal
          stats={stats}
          onRestart={handleRestart}
          onMainMenu={handleMainMenu}
        />
      )}
    </div>
  );
}
