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
import { GameOverModal } from './components/GameOverModal';
import { VictoryModal } from './components/VictoryModal';
import { RotatePrompt } from './components/RotatePrompt';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Core engines
  const sceneRef = useRef<RoomScene | null>(null);
  const miniGameRef = useRef<MiniGameEngine | null>(null);

  // Game state
  const [gameState, setGameState] = useState<GameState>('intro');
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

  // Sensor states
  const [sensorStatus, setSensorStatus] = useState<SensorStatus>({
    gyroscopeAllowed: false,
    gyroscopeActive: false,
    cameraAllowed: false,
    cameraActive: false,
    hapticsSupported: typeof navigator !== 'undefined' && 'vibrate' in navigator,
  });

  // Camera orientation angles (Euler radians)
  const cameraYaw = useRef<number>(0);
  const cameraPitch = useRef<number>(-0.45); // start looking down at console
  const targetYaw = useRef<number>(0);
  const targetPitch = useRef<number>(-0.45);

  // Gyroscope tracking
  const gyroBaseAlpha = useRef<number | null>(null);

  // Monster tracking (Pool of active monsters for classic and infinite modes)
  const monstersRef = useRef<ActiveMonster[]>([]);
  const attackingMonsterId = useRef<string | null>(null);

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

  // --- SENSOR PERMISSIONS & START GAME ---
  const handleStartGame = async (options: {
    enableGyro: boolean;
    enableCamera: boolean;
    mode: GameMode;
  }) => {
    soundEngine.init();
    modeRef.current = options.mode;
    setStats((prev) => ({ ...prev, mode: options.mode }));
    setGameState('playing');

    // 1. Gyroscope setup
    if (options.enableGyro && typeof window !== 'undefined') {
      try {
        const DeviceOrientationEventAny = window.DeviceOrientationEvent as unknown as {
          requestPermission?: () => Promise<'granted' | 'denied'>;
        };

        if (typeof DeviceOrientationEventAny?.requestPermission === 'function') {
          const perm = await DeviceOrientationEventAny.requestPermission();
          if (perm === 'granted') {
            setupGyroscope();
          }
        } else {
          setupGyroscope();
        }
      } catch (err) {
        console.warn('Gyroscope permission failed:', err);
      }
    }

    // 2. Camera WebRTC setup (Modo AR)
    if (options.enableCamera && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current && sceneRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          sceneRef.current.setupARBackground(videoRef.current);
          sceneRef.current.setARMode(true);
          setSensorStatus((s) => ({ ...s, cameraAllowed: true, cameraActive: true }));
        }
      } catch (err) {
        console.warn('Camera access denied:', err);
      }
    }
  };

  // Setup Gyroscope event listener
  const setupGyroscope = () => {
    window.addEventListener('deviceorientation', handleDeviceOrientation);
    setSensorStatus((s) => ({ ...s, gyroscopeAllowed: true, gyroscopeActive: true }));
  };

  const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
    if (e.alpha === null || e.beta === null) return;

    if (gyroBaseAlpha.current === null) {
      gyroBaseAlpha.current = e.alpha;
    }

    // Relative yaw in radians
    const diffAlpha = (e.alpha - gyroBaseAlpha.current) * (Math.PI / 180);
    // Beta: pitch (-180 to 180). Map natural holding angle (~45 deg) to horizon (0 rad)
    const betaRad = (e.beta - 45) * (Math.PI / 180);

    targetYaw.current = -diffAlpha;
    targetPitch.current = Math.max(-1.1, Math.min(0.8, -betaRad));
  };

  // Toggle Gyroscope
  const toggleGyroscope = async () => {
    if (sensorStatus.gyroscopeActive) {
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
      setSensorStatus((s) => ({ ...s, gyroscopeActive: false }));
    } else {
      setupGyroscope();
    }
  };

  // Toggle AR Camera
  const toggleCamera = async () => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (sensorStatus.cameraActive) {
      scene.setARMode(false);
      setSensorStatus((s) => ({ ...s, cameraActive: false }));
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        scene.setARMode(true);
        setSensorStatus((s) => ({ ...s, cameraActive: true }));
      } else if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            scene.setupARBackground(videoRef.current);
            scene.setARMode(true);
            setSensorStatus((s) => ({ ...s, cameraAllowed: true, cameraActive: true }));
          }
        } catch {
          // ignore
        }
      }
    }
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

  // Feign Sleep actions ("FINGIR DORMIR")
  const startSleeping = useCallback(() => {
    if (gameState !== 'playing') return;
    setIsSleeping(true);
    soundEngine.playFeignSleep();
  }, [gameState]);

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

  // Touch / Pointer Drag for 360 degree room rotation
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

    const sensitivity = 0.004;
    targetYaw.current -= deltaX * sensitivity;
    targetPitch.current = Math.max(-1.1, Math.min(0.85, targetPitch.current - deltaY * sensitivity));
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  // Restart game after GameOver
  const handleRestart = () => {
    setBoredom(15);
    setIsSleeping(false);
    setLookingAtConsole(true);
    targetPitch.current = -0.45;
    targetYaw.current = 0;
    monstersRef.current = [];
    attackingMonsterId.current = null;
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
    setGameState('playing');
  };

  // --- MAIN RENDER & GAME LOOP (requestAnimationFrame) ---
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();
    let cucoSpawnCountdown = modeRef.current === 'infinite' ? 5.0 : (14 + Math.random() * 8);
    let clockTickTimer = 0;

    const classicSpots: MonsterLocation[] = ['closet', 'door', 'window', 'footbed', 'desk'];
    const infiniteSpots: MonsterLocation[] = [
      'closet',
      'door',
      'window',
      'footbed',
      'desk',
      'underbed',
      'curtain',
      'ceiling',
      'bookshelf',
      'hallway',
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
          if (isSleeping) {
            // Feigning sleep: fills over ~18 seconds so player can trick the Cuco without falling asleep too fast
            setBoredom((prev) => {
              const next = prev + (100 / 18.0) * dt;
              if (next >= 100) {
                soundEngine.playSleepFall();
                setGameState('slept');
                return 100;
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
                setGameState('slept');
                return 100;
              }
              return next;
            });
          }

          // --- CUCO MONSTER SPAWN & AI LOGIC ---
          const isInfinite = modeRef.current === 'infinite';
          const maxMonsters = isInfinite ? Math.min(3, 2 + Math.floor(stats.gameTimeSeconds / 80)) : 1;
          const availableSpotsPool = isInfinite ? infiniteSpots : classicSpots;

          cucoSpawnCountdown -= dt;

          if (cucoSpawnCountdown <= 0 && monstersRef.current.length < maxMonsters) {
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
            }

            // Next spawn countdown: in infinite mode they spawn much more frequently!
            cucoSpawnCountdown = isInfinite
              ? (4.0 + Math.random() * 4.5)
              : (15.0 + Math.random() * 8.0);
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
                  setGameState('jumpscare');
                  soundEngine.playJumpscare();
                  break;
                }
              }
            }
          }
        } else if (gameState === 'jumpscare') {
          // Rapid Cuco lunge straight into camera!
          const attacker =
            monstersRef.current.find((m) => m.id === attackingMonsterId.current) ||
            monstersRef.current[0];
          if (attacker) {
            attacker.attackProgress = Math.min(1.0, attacker.attackProgress + dt * 4.0);
            scene.updateJumpscare(attacker.attackProgress, attacker.id);
          }
        }

        // 3. Update Scene & Handheld Console
        scene.update(dt, isLookingDown, cameraPitch.current);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, isSleeping, stats.gameTimeSeconds]);

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

      {/* Hidden WebRTC video for AR mode */}
      <video ref={videoRef} playsInline muted className="hidden" />

      {/* --- NARROW FLASHLIGHT VIGNETTE (Small focused radius in dark room) --- */}
      {!lookingAtConsole && !isSleeping && gameState === 'playing' && (
        <div
          className="pointer-events-none fixed inset-0 z-10 transition-opacity duration-300"
          style={{
            background:
              'radial-gradient(circle at center, rgba(255, 245, 225, 0.05) 0%, rgba(255, 240, 210, 0.02) 12%, rgba(0, 0, 0, 0.65) 24%, rgba(0, 0, 0, 0.96) 40%, #000000 60%)',
          }}
        />
      )}

      {/* --- BLANKET / FEIGN SLEEP COVER --- */}
      <div
        className={`pointer-events-none fixed inset-0 z-40 transition-opacity duration-300 ${
          isSleeping ? 'opacity-95' : 'opacity-0'
        } bg-slate-950 flex flex-col items-center justify-center`}
      >
        <div className="flex flex-col items-center gap-2 text-indigo-300">
          <div className="font-pixel text-xl tracking-wider text-indigo-200">
            FINGIENDO DORMIR...
          </div>
          <div className="text-xs font-retro text-2xl text-indigo-400">
            Z z z . . .
          </div>
          <div className="text-[11px] text-slate-400 font-sans-modern mt-2">
            No te muevas hasta que el Cuco se aleje
          </div>
        </div>
      </div>

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
            isSleeping={isSleeping}
            onSleepStart={startSleeping}
            onSleepEnd={endSleeping}
            onToggleLook={toggleLook}
            sensorStatus={sensorStatus}
            onToggleGyro={toggleGyroscope}
            onToggleCamera={toggleCamera}
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

      {/* --- WELCOME & PERMISSIONS MODAL --- */}
      {gameState === 'intro' && (
        <PermissionsModal
          onStartGame={handleStartGame}
          sensorStatus={sensorStatus}
        />
      )}

      {/* --- GAME OVER SCREENS (Zero delay, locks background game) --- */}
      {(gameState === 'slept' || gameState === 'jumpscare') && (
        <GameOverModal
          reason={gameState === 'jumpscare' ? 'jumpscare' : 'slept'}
          stats={stats}
          onRestart={handleRestart}
        />
      )}

      {/* --- VICTORY 6 AM SCREEN --- */}
      {gameState === 'victory' && (
        <VictoryModal stats={stats} onRestart={handleRestart} />
      )}
    </div>
  );
}
