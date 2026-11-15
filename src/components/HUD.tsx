/**
 * Top HUD and Action Controls for Desvelada.
 * - "MANTÉN: FINGIR DORMIR" is centered prominently in the top header.
 * - Fast sleep/boredom meter (3-second urgency).
 * - Minimal bottom controls for clean mobile gameplay.
 */

import React from 'react';
import {
  Volume2,
  VolumeX,
  EyeOff,
  Gamepad2,
  Moon,
  Trophy,
  Flag,
  Zap,
  Infinity as InfinityIcon,
  Flashlight,
  ShieldAlert,
} from 'lucide-react';
import { SensorStatus, GameMode } from '../types';
import { computeRemainingLevels, isHudImminentDanger } from '../game/gameLogic';

interface HUDProps {
  boredom: number; // 0 to 100
  score: number;
  gameTimeSeconds: number;
  level: number;
  mode?: GameMode;
  lookingAtConsole: boolean;
  cucoInBeam: boolean;
  isSleeping: boolean;
  onSleepStart: () => void;
  onSleepEnd: () => void;
  onToggleLook?: () => void;
  sensorStatus: SensorStatus;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const HUD: React.FC<HUDProps> = React.memo(({
  boredom,
  score,
  level,
  mode = 'classic',
  lookingAtConsole,
  cucoInBeam,
  isSleeping,
  onSleepStart,
  onSleepEnd,
  isMuted,
  onToggleMute,
}) => {
  const isHighBoredom = boredom > 65;
  const imminentDanger = isHudImminentDanger({ boredom, cucoInBeam });
  const canSleep = !lookingAtConsole && cucoInBeam;
  const remainingLevels = computeRemainingLevels(mode, level);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-between p-2 select-none">
      {/* --- TOP HEADER & CONTROLS --- */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        {/* Top bar: Score, Remaining Levels & Sound Toggle */}
        <div className="flex w-full items-center justify-between gap-1">
          {/* Left: Score, Mode & Remaining Minigame Levels */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
            <div
              data-testid="hud-score"
              className="flex items-center gap-1 rounded-xl bg-slate-950/90 px-2.5 py-1 text-white shadow-lg border border-[#f4b637]/35"
            >
              <Trophy className="h-3.5 w-3.5 text-[#f4b637]" />
              <span className="font-pixel text-[10px] tracking-wider text-[#f4b637]">
                PTS: {score}
              </span>
            </div>

            {mode === 'infinite' ? (
              <div className="flex items-center gap-1 rounded-xl bg-slate-950/90 px-2 py-1 shadow-lg border border-[#f4b637]/40 text-[#f4b637]">
                <InfinityIcon className="h-3 w-3 text-[#f4b637]" />
                <span className="font-pixel text-[9px] tracking-wider">
                  INFINITO · LVL {level}
                </span>
              </div>
            ) : (
              <>
                <div
                  data-testid="hud-remaining-levels"
                  className="flex items-center gap-1 rounded-xl bg-slate-950/90 px-2.5 py-1 shadow-lg border border-[#f4b637]/45"
                >
                  <Flag className="h-3 w-3 text-[#f4b637]" />
                  <span className="font-pixel text-[9px] text-[#f4b637] tracking-wider">
                    {remainingLevels === 1
                      ? 'FALTA 1 NIVEL'
                      : `FALTAN ${remainingLevels} NIVELES`}
                  </span>
                </div>

                <div className="hidden sm:flex items-center gap-1 rounded-xl bg-slate-950/90 px-2 py-1 shadow-lg border border-[#f4b637]/30">
                  <Zap className="h-3 w-3 text-[#f4b637]" />
                  <span className="font-pixel text-[9px] text-[#f4b637] tracking-wider">
                    LVL {level}/15
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Right: Sound Toggle */}
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl bg-slate-950/90 p-1 shadow-lg border border-[#f4b637]/30">
            <button
              type="button"
              aria-label={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
              onClick={onToggleMute}
              className="rounded-lg bg-slate-900 p-1.5 text-[#f4b637] hover:text-white transition active:scale-95 cursor-pointer"
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5 text-[#f4b637]" />}
            </button>
          </div>
        </div>

        {/* TOP CENTER: "HACERSE EL DORMIDO" BUTTON (CONDITION: MUST AIM AT CUCO IN ROOM) */}
        <div className="pointer-events-auto flex flex-col items-center w-full max-w-sm px-2">
          <button
            type="button"
            onPointerDown={canSleep || isSleeping ? onSleepStart : undefined}
            onPointerUp={onSleepEnd}
            onPointerLeave={onSleepEnd}
            disabled={!canSleep && !isSleeping}
            className={`w-full flex items-center justify-center gap-3 rounded-2xl py-3 px-4 shadow-2xl transition-all select-none ${
              isSleeping
                ? 'bg-slate-900 text-[#f4b637] border-2 border-[#f4b637] scale-95 shadow-[#f4b637]/30 ring-4 ring-[#f4b637]/25'
                : canSleep
                ? 'bg-[#f4b637] text-slate-950 border-2 border-yellow-100 shadow-[0_0_24px_rgba(244,182,55,0.65)] animate-pulse active:scale-95 cursor-pointer ring-2 ring-[#f4b637]/60'
                : lookingAtConsole
                ? 'bg-slate-950/85 text-slate-400 border border-slate-800 opacity-75 cursor-not-allowed'
                : 'bg-slate-950/90 text-[#f4b637] border border-[#f4b637]/45 opacity-90 cursor-not-allowed'
            }`}
          >
            {isSleeping ? (
              <>
                <EyeOff className="h-6 w-6 text-[#f4b637] animate-pulse" />
                <div className="flex flex-col items-start leading-tight">
                  <span className="font-pixel text-xs sm:text-sm tracking-wider text-[#f4b637]">
                    ¡DURMIENDO! (SOLTAR PARA VER)
                  </span>
                  <span className="text-[10px] text-slate-200 font-sans-modern">
                    Ojos cerrados · El Cuco retrocede
                  </span>
                </div>
              </>
            ) : canSleep ? (
              <>
                <ShieldAlert className="h-6 w-6 text-slate-950 animate-bounce" />
                <div className="flex flex-col items-start leading-tight text-left">
                  <span className="font-pixel text-xs sm:text-sm tracking-wider text-slate-950 font-bold">
                    ¡MANTÉN: HACERSE EL DORMIDO!
                  </span>
                  <span className="text-[10px] text-slate-900 font-sans-modern font-bold">
                    ¡Cuco en la linterna! Cierra los ojos ya
                  </span>
                </div>
              </>
            ) : lookingAtConsole ? (
              <>
                <Gamepad2 className="h-5 w-5 text-[#f4b637]/70" />
                <div className="flex flex-col items-start leading-tight text-left">
                  <span className="font-pixel text-[11px] text-[#f4b637]/90">
                    JUGANDO EN CONSOLA
                  </span>
                  <span className="text-[9.5px] text-slate-400 font-sans-modern">
                    Para dormir, levanta la vista y mira la habitación
                  </span>
                </div>
              </>
            ) : (
              <>
                <Flashlight className="h-5 w-5 text-[#f4b637] animate-pulse" />
                <div className="flex flex-col items-start leading-tight text-left">
                  <span className="font-pixel text-[11px] text-[#f4b637]">
                    APUNTA AL CUCO CON LA LINTERNA
                  </span>
                  <span className="text-[9.5px] text-slate-300 font-sans-modern">
                    Ilumínalo hasta que parpadee la luz para poder dormirte
                  </span>
                </div>
              </>
            )}
          </button>

          {/* Intuitive Sleep / Boredom Meter - PULSES IN #f4b637 ON IMMINENT DANGER */}
          <div
            data-testid="boredom-meter"
            data-danger={imminentDanger ? 'true' : 'false'}
            className={`mt-1.5 w-full rounded-xl bg-slate-950/95 p-2 shadow-2xl ring-1 ring-black transition-colors ${
              imminentDanger
                ? 'border-2 border-[#f4b637] animate-hud-alert-pulse'
                : 'border border-[#f4b637]/30'
            }`}
          >
            <div className="flex items-center justify-between text-[9px] uppercase font-sans-modern font-bold tracking-wide">
              <span className="flex items-center gap-1.5 text-slate-200">
                <Moon
                  className={`h-3 w-3 text-[#f4b637] ${
                    imminentDanger ? 'animate-pulse' : ''
                  }`}
                />
                <span>Nivel de Sueño:</span>
                {isSleeping && (
                  <span className="ml-1 text-[8px] text-slate-950 font-bold font-sans-modern bg-[#f4b637] px-1.5 py-0.5 rounded-full">
                    Avanzando lento...
                  </span>
                )}
              </span>
              <span
                className={`font-pixel text-[9px] flex items-center gap-1 text-[#f4b637] ${
                  imminentDanger ? 'animate-pulse' : ''
                }`}
              >
                {isHighBoredom
                  ? '¡PELIGRO! TE DUERMES'
                  : cucoInBeam
                  ? '¡ALERTA CUCO!'
                  : boredom > 35
                  ? 'SOMNOLIENTO'
                  : 'DESPIERTO'}
                <span className="text-[8px] font-mono text-slate-400">({Math.round(boredom)}%)</span>
              </span>
            </div>

            {/* Smooth intuitive segmented progress bar */}
            <div className="mt-1 relative h-2.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
              <div
                data-testid="boredom-bar"
                className={`h-full transition-all duration-150 rounded-full ${
                  imminentDanger
                    ? 'bg-[#f4b637] animate-hud-bar-pulse'
                    : 'bg-gradient-to-r from-[#f4b637]/80 to-[#f4b637]'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, boredom))}%` }}
              />
              {/* Subtle visual tick lines for intuitive gauge feel */}
              <div className="absolute inset-0 flex justify-between px-2 pointer-events-none opacity-20">
                <div className="w-px h-full bg-white" />
                <div className="w-px h-full bg-white" />
                <div className="w-px h-full bg-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

