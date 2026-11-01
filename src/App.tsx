/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameState, MiniGameType, MonsterLocation, MonsterState, SensorStatus, GameStats } from './types';
import { soundEngine } from './audio/SoundEngine';
import { MiniGameEngine } from './minigames/MiniGameEngine';
import { RoomScene } from './three/RoomScene';
import { HUD } from './components/HUD';
import { ConsoleControls } from './components/ConsoleControls';
import { PermissionsModal } from './components/PermissionsModal';
import { GameOverModal } from './components/GameOverModal';
import { VictoryModal } from './components/VictoryModal';

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
  const [currentMinigame, setCurrentMinigame] = useState<MiniGameType>('flappy');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [cucoWarning, setCucoWarning] = useState<boolean>(false);

  // Time & stats
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    monstersRepelled: 0,
    timeSurvivedMinutes: 0,
    currentHour: 0, // 0 = 12 AM
    gameTimeSeconds: 0,
  });

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
  const cameraPitch = useRef<number>(-0.45); // start looking at console
  const targetYaw = useRef<number>(0);
  const targetPitch = useRef<number>(-0.45);

  // Gyroscope tracking
  const gyroBaseAlpha = useRef<number | null>(null);

  // Monster tracking
  const monsterRef = useRef<MonsterState>({
    active: false,
    location: 'closet',
    timer: 5.0,
    maxTimer: 5.0,
    spotted: false,
    isAttacking: false,
    attackProgress: 0,
  });

  // Drag interaction
  const isDragging = useRef<boolean>(false);
  const lastTouchX = useRef<number>(0);
  const lastTouchY = useRef<number>(0);

  // --- INITIALIZE ENGINES ON MOUNT ---
  useEffect(() => {
    if (!mountRef.current) return;

    const miniGame = new MiniGameEngine();
    miniGameRef.current = miniGame;

    // Reduce boredom on minigame actions
    miniGame.onActionSuccess = () => {
      setBoredom((prev) => Math.max(0, prev - 4.5));
      setStats((prev) => ({ ...prev, score: miniGame.score }));
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
  const handleStartGame = async (options: { enableGyro: boolean; enableCamera: boolean }) => {
    soundEngine.init();
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
        mini.reset();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
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
  }, [toggleLook, startSleeping, endSleeping]);

  // Touch / Pointer Drag for 360 degree room rotation
  const handlePointerDown = (e: React.PointerEvent) => {
    // If tapping UI buttons, ignore drag
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    isDragging.current = true;
    lastTouchX.current = e.clientX;
    lastTouchY.current = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
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

  // Change Minigame
  const handleMinigameChange = (type: MiniGameType) => {
    setCurrentMinigame(type);
    miniGameRef.current?.setGameType(type);
    soundEngine.playButtonClick();
  };

  // Restart game
  const handleRestart = () => {
    setBoredom(15);
    setIsSleeping(false);
    setLookingAtConsole(true);
    targetPitch.current = -0.45;
    targetYaw.current = 0;
    monsterRef.current = {
      active: false,
      location: 'closet',
      timer: 5.0,
      maxTimer: 5.0,
      spotted: false,
      isAttacking: false,
      attackProgress: 0,
    };
    sceneRef.current?.hideCuco();
    miniGameRef.current?.reset();
    setStats({
      score: 0,
      monstersRepelled: 0,
      timeSurvivedMinutes: 0,
      currentHour: 0,
      gameTimeSeconds: 0,
    });
    setGameState('playing');
  };

  // --- MAIN RENDER & GAME LOOP (requestAnimationFrame) ---
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();
    let cucoSpawnCountdown = 12 + Math.random() * 8; // seconds until first spawn
    let clockTickTimer = 0;
    let heartbeatTimer = 0;

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

        // 2. State specific updates
        if (gameState === 'playing') {
          // --- Clock & Night Progression ---
          clockTickTimer += dt;
          if (clockTickTimer >= 1.0) {
            clockTickTimer = 0;
            soundEngine.playClockTick();
            setStats((prev) => {
              const newSeconds = prev.gameTimeSeconds + 1;
              // 40 seconds = 1 in-game hour (total night = 240 seconds ~ 4 minutes)
              const hour = Math.floor(newSeconds / 40);
              const hourDisplay = hour === 0 ? '12:00 AM' : `${hour}:00 AM`;
              scene.updateClockDisplay(hourDisplay);

              // Check 6:00 AM Dawn victory!
              if (hour >= 6) {
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
          if (isSleeping) {
            // Feigning sleep: boredom increases slightly slower or pauses
            setBoredom((prev) => Math.min(100, prev + 1.2 * dt));
          } else if (isLookingDown) {
            // Looking at console: actively playing minigame
            miniGame.update(dt);
            // Passive small boredom drain if interacting
            setBoredom((prev) => Math.min(100, prev + 0.8 * dt));
          } else {
            // Looking around the room: NOT playing minigame! Boredom rises faster!
            setBoredom((prev) => {
              const next = prev + 3.2 * dt;
              if (next >= 100) {
                // Fell asleep!
                soundEngine.playSleepFall();
                setGameState('slept');
                return 100;
              }
              return next;
            });
          }

          // --- CUCO MONSTER LOGIC ---
          const monster = monsterRef.current;
          if (!monster.active) {
            cucoSpawnCountdown -= dt;
            if (cucoSpawnCountdown <= 0) {
              // Spawn Cuco in a random spot!
              const spots: MonsterLocation[] = ['closet', 'door', 'window', 'footbed', 'desk'];
              const chosen = spots[Math.floor(Math.random() * spots.length)];
              monster.active = true;
              monster.location = chosen;
              // Timer to feign sleep: 4.5 seconds
              monster.timer = 4.5;
              monster.maxTimer = 4.5;
              monster.spotted = false;
              monster.isAttacking = false;
              monster.attackProgress = 0;

              scene.spawnCuco(chosen);
              soundEngine.playMonsterStalk();
              setCucoWarning(true);
            }
          } else {
            // Heartbeat audio while monster is present
            heartbeatTimer += dt;
            const heartInterval = Math.max(0.4, monster.timer / monster.maxTimer * 1.2);
            if (heartbeatTimer >= heartInterval) {
              heartbeatTimer = 0;
              const urgency = 1 - monster.timer / monster.maxTimer;
              soundEngine.playHeartbeat(urgency);
            }

            if (isSleeping) {
              // Player successfully feigned sleep!
              // Decrement attack threat or repel monster after 1.4 seconds of sleep
              monster.timer -= dt * 2.0;
              if (monster.timer <= 1.0) {
                // Cuco is fooled and retreats!
                scene.hideCuco();
                soundEngine.playMonsterRetreat();
                monster.active = false;
                setCucoWarning(false);
                setStats((prev) => ({ ...prev, monstersRepelled: prev.monstersRepelled + 1 }));
                cucoSpawnCountdown = 14 + Math.random() * 10;
              }
            } else {
              // Player is NOT sleeping: countdown to jumpscare!
              monster.timer -= dt;
              if (monster.timer <= 0) {
                // JUMPSCARE TRIGGERED!
                monster.isAttacking = true;
                setGameState('jumpscare');
                soundEngine.playJumpscare();
              }
            }
          }
        } else if (gameState === 'jumpscare') {
          // Animate Cuco charging forward directly into camera!
          const monster = monsterRef.current;
          monster.attackProgress = Math.min(1.0, monster.attackProgress + dt * 2.2);
          scene.updateJumpscare(monster.attackProgress);

          if (monster.attackProgress >= 1.0) {
            // Once jumped, show Game Over
            setTimeout(() => {
              scene.hideCuco();
            }, 600);
          }
        }

        // 3. Update Scene & Handheld Console
        scene.update(dt, isLookingDown, cameraPitch.current);
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
      {/* Three.js Canvas Mount Container */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />

      {/* Hidden WebRTC video for AR mode */}
      <video ref={videoRef} playsInline muted className="hidden" />

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
            background: `radial-gradient(ellipse at center, transparent 35%, rgba(10, 5, 20, ${
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
            lookingAtConsole={lookingAtConsole}
            isSleeping={isSleeping}
            onSleepStart={startSleeping}
            onSleepEnd={endSleeping}
            onToggleLook={toggleLook}
            currentMinigame={currentMinigame}
            onChangeMinigame={handleMinigameChange}
            sensorStatus={sensorStatus}
            onToggleGyro={toggleGyroscope}
            onToggleCamera={toggleCamera}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            cucoWarning={cucoWarning}
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
            onButtonBPress={() => miniGameRef.current?.reset()}
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

      {/* --- GAME OVER SCREENS --- */}
      {(gameState === 'jumpscare' || gameState === 'slept') &&
        monsterRef.current.attackProgress >= 0.8 && (
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
