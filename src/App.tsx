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
import {
  computeInitialCucoSpawnDelay,
  computePostTutorialCucoDelay,
  computeCucoSpawnInterval,
  computeCucoDangerHeartbeatState,
  computeNextCreakDelay,
  shouldPlayRoomCreak,
  computeNextBoredom,
  shouldSyncBoredomUi,
  TUTORIAL_STORAGE_KEY,
  shouldShowFirstTimeTutorial,
  shouldWinClassicOnLevelClear,
} from './game/gameLogic';
import { HUD, TutorialHighlightTarget } from './components/HUD';
import { ConsoleControls } from './components/ConsoleControls';
import { PermissionsModal } from './components/PermissionsModal';
import { TutorialOverlay } from './components/TutorialOverlay';
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
  const boredomRef = useRef<number>(15);
  const lastBoredomCommitRef = useRef<number>(15);
  const lastBoredomSyncTimeRef = useRef<number>(0);
  const [isSleeping, setIsSleeping] = useState<boolean>(false);
  const [lookingAtConsole, setLookingAtConsole] = useState<boolean>(true);
  const lookingAtConsoleRef = useRef<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  isMutedRef.current = isMuted;

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
  const cucoInBeamRef = useRef<boolean>(false);
  const lastBeamScreechAtRef = useRef<number>(0);
  const [lossNotice, setLossNotice] = useState<'cuco' | 'sleep' | null>(null);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [tutorialHighlight, setTutorialHighlight] = useState<TutorialHighlightTarget>(null);
  const showTutorialRef = useRef<boolean>(false);
  showTutorialRef.current = showTutorial;

  // Camera orientation angles (Euler radians)
  const cameraYaw = useRef<number>(0);
  const cameraPitch = useRef<number>(-0.45); // start looking down at console
  const targetYaw = useRef<number>(0);
  const targetPitch = useRef<number>(-0.45);

  // Monster tracking (Pool of active monsters for classic and infinite modes)
  const monstersRef = useRef<ActiveMonster[]>([]);
  const attackingMonsterId = useRef<string | null>(null);
  const cucoSpawnCountdown = useRef<number>(computeInitialCucoSpawnDelay());
  const creakCountdown = useRef<number>(computeNextCreakDelay());
  const heartbeatCountdown = useRef<number>(0);
  const wasHeartbeatActive = useRef<boolean>(false);
  const jumpscareTimer = useRef<number>(0);
  const gameTimeSecondsRef = useRef<number>(0);
  const [showGameOver, setShowGameOver] = useState<boolean>(false);

  // Drag interaction
  const isDragging = useRef<boolean>(false);
  const lastTouchX = useRef<number>(0);
  const lastTouchY = useRef<number>(0);

  const commitBoredom = useCallback((nextVal: number, force: boolean = false) => {
    boredomRef.current = nextVal;
    const now = performance.now();
    if (
      force ||
      shouldSyncBoredomUi(
        lastBoredomCommitRef.current,
        nextVal,
        now - lastBoredomSyncTimeRef.current
      )
    ) {
      lastBoredomCommitRef.current = nextVal;
      lastBoredomSyncTimeRef.current = now;
      setBoredom(nextVal);
    }
  }, []);

  // --- INITIALIZE ENGINES ON MOUNT ---
  useEffect(() => {
    if (!mountRef.current) return;

    const miniGame = new MiniGameEngine();
    miniGameRef.current = miniGame;

    // Reduce boredom on alien hit
    miniGame.onActionSuccess = () => {
      commitBoredom(Math.max(0, boredomRef.current - 4.0), true);
      setStats((prev) => {
        const nextScore = miniGame.score;
        const nextHigh = Math.max(prev.highScore, nextScore);
        if (prev.mode === 'infinite' && nextScore > prev.highScore) {
          localStorage.setItem('desvelada_infinite_highscore', String(nextScore));
        }
        return { ...prev, score: nextScore, highScore: nextHigh };
      });
    };

    // Level up reward (steady Cuco spawn cadence without level acceleration)
    miniGame.onLevelUp = (newLevel) => {
      commitBoredom(Math.max(0, boredomRef.current - 22), true); // big adrenaline rush on level clear!
      setStats((prev) => {
        const nextScore = miniGame.score;
        const nextHigh = Math.max(prev.highScore, nextScore);
        if (prev.mode === 'infinite' && nextScore > prev.highScore) {
          localStorage.setItem('desvelada_infinite_highscore', String(nextScore));
        }
        return { ...prev, level: newLevel, score: nextScore, highScore: nextHigh };
      });
    };

    // Classic Mode Victory: Reach and clear Level 15 (Crowned Final Boss)
    miniGame.onLevelCleared = (clearedLevel) => {
      if (shouldWinClassicOnLevelClear(modeRef.current, clearedLevel)) {
        soundEngine.stopHeartbeat();
        soundEngine.stopAmbienteMusic();
        soundEngine.stopConsolaMusic();
        soundEngine.playVictoryFanfare();
        setStats((prev) => ({
          ...prev,
          level: clearedLevel,
          score: miniGame.score,
          highScore: Math.max(prev.highScore, miniGame.score),
        }));
        setGameState('victory');
        return true;
      }
      return false;
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

  // Sync body dataset state for reliable automation & testing
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.state =
        gameState === 'intro'
          ? 'title'
          : gameState === 'victory' || gameState === 'slept'
          ? 'gameover'
          : 'playing';
      document.body.dataset.tutorial = showTutorial ? 'true' : 'false';
    }
  }, [gameState, showTutorial]);

  // Support ?autostart=1 (and optional ?level=15 / ?tutorial=0) to jump directly into gameplay
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' && gameStateRef.current === 'intro') {
        const parsedLevel = parseInt(params.get('level') || '0', 10);
        handleStartGame({
          mode: 'classic',
          skipTutorial: params.get('tutorial') === '0',
          startLevel: parsedLevel > 0 ? parsedLevel : undefined,
        });
      }
    }
  }, []);

  // --- START GAME (Touch only) ---
  const handleStartGame = (options: { mode: GameMode; skipTutorial?: boolean; startLevel?: number }) => {
    const storedFlag =
      typeof window !== 'undefined' ? localStorage.getItem(TUTORIAL_STORAGE_KEY) : '1';
    const shouldActivateTutorial =
      !options.skipTutorial && shouldShowFirstTimeTutorial(storedFlag, false);

    soundEngine.setTutorialSilent(shouldActivateTutorial);
    soundEngine.init();
    soundEngine.stopGameOverMusic();
    soundEngine.stopAmbienteMusic();
    setLossNotice(null);
    modeRef.current = options.mode;
    gameTimeSecondsRef.current = 0;

    showTutorialRef.current = shouldActivateTutorial;
    setShowTutorial(shouldActivateTutorial);

    commitBoredom(15, true);
    setIsSleeping(false);
    lookingAtConsoleRef.current = true;
    setLookingAtConsole(true);
    targetPitch.current = -0.45;
    targetYaw.current = 0;
    monstersRef.current = [];
    attackingMonsterId.current = null;
    cucoSpawnCountdown.current = computeInitialCucoSpawnDelay();
    creakCountdown.current = computeNextCreakDelay();
    heartbeatCountdown.current = 0;
    wasHeartbeatActive.current = false;
    jumpscareTimer.current = 0;
    lastBeamScreechAtRef.current = 0;
    setShowGameOver(false);
    sceneRef.current?.hideAllCucos();

    if (miniGameRef.current) {
      if (options.startLevel && options.startLevel > 1) {
        miniGameRef.current.level = options.startLevel;
        miniGameRef.current.reset(true);
      } else {
        miniGameRef.current.reset(false);
      }
      miniGameRef.current.setPaused(shouldActivateTutorial);
    }

    setStats((prev) => ({
      ...prev,
      mode: options.mode,
      level: miniGameRef.current?.level ?? 1,
      score: 0,
      monstersRepelled: 0,
      currentHour: 0,
      gameTimeSeconds: 0,
    }));

    if (shouldActivateTutorial) {
      // Zero sound while tutorial overlay explains mechanics
      soundEngine.setTutorialSilent(true);
    } else {
      soundEngine.setTutorialSilent(false);
      soundEngine.playConsolaMusic();
    }
    setGameState('playing');
  };

  const handleTutorialComplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
    }
    showTutorialRef.current = false;
    setShowTutorial(false);
    setTutorialHighlight(null);

    // Guarantee at least >1s safe grace window after finishing tutorial before Cuco can appear
    cucoSpawnCountdown.current = computePostTutorialCucoDelay(cucoSpawnCountdown.current);
    creakCountdown.current = computeNextCreakDelay();
    heartbeatCountdown.current = 0;
    wasHeartbeatActive.current = false;

    miniGameRef.current?.setPaused(false);
    soundEngine.setTutorialSilent(false);
    soundEngine.playConsolaMusic();
  }, []);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    const nextMute = !isMutedRef.current;
    setIsMuted(nextMute);
    soundEngine.setMuted(nextMute);
  }, []);

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
    if (gameState !== 'playing' || showTutorialRef.current) return;
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
      if (gameState !== 'playing' || showTutorialRef.current) return;
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
    if (gameState !== 'playing' || showTutorialRef.current) return;
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    isDragging.current = true;
    lastTouchX.current = e.clientX;
    lastTouchY.current = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (gameState !== 'playing' || showTutorialRef.current || !isDragging.current) return;
    const deltaX = e.clientX - lastTouchX.current;
    const deltaY = e.clientY - lastTouchY.current;
    lastTouchX.current = e.clientX;
    lastTouchY.current = e.clientY;

    // Detect touch pointers or mobile/tablet devices
    const isMobileOrTablet =
      e.pointerType === 'touch' ||
      e.pointerType === 'pen' ||
      (typeof navigator !== 'undefined' &&
        (navigator.maxTouchPoints > 0 ||
          /Android|iPhone|iPad|iPod|Tablet|Silk|Mobile/i.test(navigator.userAgent)));

    // USER REQUIREMENT: Aumentar un 30% la sensibilidad en dispositivos móviles y tablets
    // Base sensitivity 0.0035 -> Mobile/tablet sensitivity 0.0035 * 1.30 = 0.00455
    const sensitivity = isMobileOrTablet ? 0.00455 : 0.0035;

    // USER REQUIREMENT: Impedir al jugador ver los bordes o parte negra de la imagen
    // Clamped strictly to [-1.10, 1.10] radians (~ -63° to +63°) and pitch to [-0.55, 0.35]
    targetYaw.current = Math.max(-1.10, Math.min(1.10, targetYaw.current - deltaX * sensitivity));
    targetPitch.current = Math.max(-0.55, Math.min(0.35, targetPitch.current - deltaY * sensitivity));
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  // Restart game after Victory/GameOver (tutorial NEVER triggers on retry)
  const handleRestart = () => {
    soundEngine.setTutorialSilent(false);
    soundEngine.stopHeartbeat();
    soundEngine.stopGameOverMusic();
    soundEngine.stopAmbienteMusic();
    showTutorialRef.current = false;
    setShowTutorial(false);
    gameTimeSecondsRef.current = 0;
    commitBoredom(15, true);
    setIsSleeping(false);
    lookingAtConsoleRef.current = true;
    setLookingAtConsole(true);
    targetPitch.current = -0.45;
    targetYaw.current = 0;
    monstersRef.current = [];
    attackingMonsterId.current = null;
    cucoSpawnCountdown.current = computeInitialCucoSpawnDelay();
    creakCountdown.current = computeNextCreakDelay();
    heartbeatCountdown.current = 0;
    wasHeartbeatActive.current = false;
    jumpscareTimer.current = 0;
    lastBeamScreechAtRef.current = 0;
    setShowGameOver(false);
    sceneRef.current?.hideAllCucos();

    // If replaying after winning Classic Level 15, restart Classic from Level 1; otherwise keep level
    const restartFromLvl1 = gameState === 'victory' && modeRef.current === 'classic';
    miniGameRef.current?.reset(!restartFromLvl1);
    const currentLevel = miniGameRef.current?.level ?? 1;

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
  const handleMainMenu = useCallback(() => {
    soundEngine.setTutorialSilent(false);
    soundEngine.stopHeartbeat();
    soundEngine.stopConsolaMusic();
    // USER REQUIREMENT: "ambiente.mp3" sea la canción del menú, y evitar que se reproduzca al mismo tiempo que game over.mp3
    if (!soundEngine.isGameOverPlaying()) {
      soundEngine.playAmbienteMusic();
    }
    showTutorialRef.current = false;
    setShowTutorial(false);
    gameTimeSecondsRef.current = 0;
    commitBoredom(15, true);
    setIsSleeping(false);
    lookingAtConsoleRef.current = true;
    setLookingAtConsole(true);
    targetPitch.current = -0.45;
    targetYaw.current = 0;
    monstersRef.current = [];
    attackingMonsterId.current = null;
    cucoSpawnCountdown.current = computeInitialCucoSpawnDelay();
    creakCountdown.current = computeNextCreakDelay();
    heartbeatCountdown.current = 0;
    wasHeartbeatActive.current = false;
    jumpscareTimer.current = 0;
    lastBeamScreechAtRef.current = 0;
    setShowGameOver(false);
    sceneRef.current?.hideAllCucos();
    miniGameRef.current?.reset(false);
    setGameState('intro');
  }, [commitBoredom]);

  // --- MAIN RENDER & GAME LOOP (requestAnimationFrame / software-WebGL paced) ---
  useEffect(() => {
    let frameId = 0;
    let isTimer = false;
    let cancelled = false;
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
      if (cancelled) return;
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
        const tutorialActive = showTutorialRef.current;

        if (lookingAtConsoleRef.current !== isLookingDown) {
          lookingAtConsoleRef.current = isLookingDown;
          setLookingAtConsole(isLookingDown);

          // Audio transition triggered only on view switch (avoids 60Hz media element seeks)
          if (gameState === 'playing' && !tutorialActive) {
            if (isLookingDown) {
              soundEngine.playConsolaMusic();
            } else {
              soundEngine.stopConsolaMusic();
              soundEngine.stopAmbienteMusic();
            }
          }
        }

        // Subtle random bedroom creaking sounds when focused on the console to build tension
        if (!tutorialActive && shouldPlayRoomCreak({ gameState, lookingAtConsole: isLookingDown, isSleeping })) {
          creakCountdown.current -= dt;
          if (creakCountdown.current <= 0) {
            soundEngine.playRoomCreak();
            creakCountdown.current = computeNextCreakDelay();
          }
        }

        // PAUSE / RESUME MINIGAME:
        // When looking down (and tutorial is not blocking), minigame runs active!
        // When looking up at the room, tutorial is open, OR feigning sleep, minigame pauses immediately!
        if (!tutorialActive && isLookingDown && !isSleeping && gameState === 'playing') {
          miniGame.setPaused(false);
          miniGame.update(dt);
        } else {
          miniGame.setPaused(true);
        }

        // 2. State specific updates (frozen while first-time tutorial overlay is open)
        if (gameState === 'playing' && !tutorialActive) {
          // --- Clock & Night Progression ---
          clockTickTimer += dt;
          if (clockTickTimer >= 1.0) {
            clockTickTimer -= 1.0;
            soundEngine.playClockTick();
            setStats((prev) => {
              const newSeconds = prev.gameTimeSeconds + 1;
              gameTimeSecondsRef.current = newSeconds;
              const hour = Math.floor(newSeconds / 40);
              const wrappedHour = hour % 12;
              const hourDisplay = wrappedHour === 0 ? '12:00 AM' : `${wrappedHour}:00 AM`;
              scene.updateClockDisplay(hourDisplay);

              return {
                ...prev,
                gameTimeSeconds: newSeconds,
                currentHour: hour,
              };
            });
          }

          // --- Boredom / Sleep Meter Logic (computed at full 60Hz, HUD synced smoothly via throttle) ---
          const nextBoredom = computeNextBoredom(
            boredomRef.current,
            dt,
            isLookingDown,
            isSleeping
          );
          if (!isLookingDown && nextBoredom >= 100) {
            soundEngine.stopHeartbeat();
            soundEngine.playSleepFall();
            soundEngine.playGameOverMusic(() => {
              if (gameStateRef.current === 'intro') {
                soundEngine.playAmbienteMusic();
              }
            });
            setLossNotice('sleep');
            handleMainMenu();
          } else {
            commitBoredom(nextBoredom);
          }

          // --- CUCO MONSTER SPAWN & AI LOGIC ---
          const isInfinite = modeRef.current === 'infinite';
          const maxMonsters = isInfinite
            ? Math.min(3, 2 + Math.floor(gameTimeSecondsRef.current / 80))
            : 1;
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

            // Steady base spawn interval without level-based acceleration
            cucoSpawnCountdown.current = computeCucoSpawnInterval(
              modeRef.current,
              Math.random()
            );
          }

          // Process all active monsters
          if (monstersRef.current.length > 0) {
            if (isSleeping) {
              // Player is pretending to sleep:
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
                  lookingAtConsoleRef.current = false;
                  setLookingAtConsole(false);
                  const loc = RoomScene.LOCATIONS[m.location];
                  if (loc) {
                    targetYaw.current = -Math.atan2(loc.pos[0], -loc.pos[2]);
                  }

                  // Stop gameplay audio & danger heartbeat immediately on jump/loss
                  soundEngine.stopHeartbeat();
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

          // Al perder por ataque de Cuco, reproducir "game over.mp3" una vez, luego ambiente.mp3 en menú
          if (jumpscareTimer.current >= 1.2) {
            soundEngine.stopHeartbeat();
            soundEngine.playGameOverMusic(() => {
              if (gameStateRef.current === 'intro') {
                soundEngine.playAmbienteMusic();
              }
            });
            setLossNotice('cuco');
            handleMainMenu();
          }
        }

        // Accelerating danger heartbeat when the Cuco is about to catch the player
        // Immediately stops on loss (jumpscare/intro), sleep, victory, or during tutorial
        const hb = computeCucoDangerHeartbeatState({
          gameState,
          isSleeping,
          tutorialActive,
          monsters: monstersRef.current,
        });
        if (hb.active) {
          heartbeatCountdown.current -= dt;
          if (heartbeatCountdown.current <= 0) {
            soundEngine.playHeartbeat(hb.urgency);
            heartbeatCountdown.current = hb.intervalSec;
          }
          wasHeartbeatActive.current = true;
        } else if (wasHeartbeatActive.current) {
          soundEngine.stopHeartbeat();
          heartbeatCountdown.current = 0;
          wasHeartbeatActive.current = false;
        }

        // 3. Update Scene & Handheld Console (freeze particle/scene motion while tutorial is open)
        scene.update(tutorialActive ? 0 : dt, isLookingDown, cameraPitch.current, miniGame.renderVersion);
        // Track whether player is aiming flashlight at Cuco in the dark room
        const nextCucoInBeam = scene.isCucoInFlashlightBeam && !isLookingDown;
        if (cucoInBeamRef.current !== nextCucoInBeam) {
          cucoInBeamRef.current = nextCucoInBeam;
          setCucoInBeam(nextCucoInBeam);
          if (nextCucoInBeam && gameState === 'playing' && !showTutorialRef.current) {
            const nowMs = performance.now();
            if (nowMs - lastBeamScreechAtRef.current > 1400) {
              lastBeamScreechAtRef.current = nowMs;
              soundEngine.playCucoBeamScreech();
            }
          }
        }
      }

      if (scene?.isSoftwareGl) {
        isTimer = true;
        frameId = scene.afterDraw(() => loop(performance.now()));
      } else {
        isTimer = false;
        frameId = requestAnimationFrame(loop);
      }
    };

    frameId = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (isTimer) {
        clearTimeout(frameId);
      } else {
        cancelAnimationFrame(frameId);
      }
    };
  }, [gameState, isSleeping, commitBoredom, handleMainMenu]);

  const handleDpadChange = useCallback(
    (dir: { up: boolean; down: boolean; left: boolean; right: boolean }) => {
      if (showTutorialRef.current) return;
      const mini = miniGameRef.current;
      if (mini) {
        mini.dpadUp = dir.up;
        mini.dpadDown = dir.down;
        mini.dpadLeft = dir.left;
        mini.dpadRight = dir.right;
      }
    },
    []
  );

  const handleButtonAPress = useCallback(() => {
    if (showTutorialRef.current) return;
    miniGameRef.current?.triggerActionA();
  }, []);

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
      <div ref={mountRef} data-testid="scene-mount" className="absolute inset-0 h-full w-full" />

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
            score={stats.score}
            gameTimeSeconds={stats.gameTimeSeconds}
            level={stats.level}
            mode={stats.mode}
            lookingAtConsole={lookingAtConsole}
            cucoInBeam={cucoInBeam}
            isSleeping={isSleeping}
            onSleepStart={startSleeping}
            onSleepEnd={endSleeping}
            sensorStatus={sensorStatus}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            tutorialHighlight={showTutorial ? tutorialHighlight : null}
          />

          <ConsoleControls
            visible={lookingAtConsole}
            onDpadChange={handleDpadChange}
            onButtonAPress={handleButtonAPress}
            highlightControls={showTutorial && tutorialHighlight === 'controls'}
          />

          <TutorialOverlay
            visible={showTutorial}
            onComplete={handleTutorialComplete}
            onHighlightChange={setTutorialHighlight}
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
