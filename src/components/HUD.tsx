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
  Clock,
  Zap,
  Infinity as InfinityIcon,
  Flashlight,
  ShieldAlert,
} from 'lucide-react';
import { SensorStatus, GameMode } from '../types';

interface HUDProps {
  boredom: number; // 0 to 100
  timeString: string;
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

export const HUD: React.FC<HUDProps> = ({
  boredom,
  timeString,
  level,
  mode = 'classic',
  lookingAtConsole,
  cucoInBeam,
  isSleeping,
  onSleepStart,
  onSleepEnd,
  onToggleLook,
  isMuted,
  onToggleMute,
}) => {
  const isHighBoredom = boredom > 65;
  const canSleep = !lookingAtConsole && cucoInBeam;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-between p-2 select-none">
      {/* --- TOP HEADER & CONTROLS --- */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        {/* Top bar: Stats and Sound Toggle */}
        <div className="flex w-full items-center justify-between gap-1">
          {/* Left: Clock, Mode & Level */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-xl bg-slate-950/90 px-2.5 py-1 text-white shadow-lg border border-slate-800">
              <Clock className="h-3.5 w-3.5 text-rose-400" />
              <span className="font-pixel text-[11px] tracking-wider text-rose-300">
                {timeString}
              </span>
            </div>

            {mode === 'infinite' ? (
              <div className="flex items-center gap-1 rounded-xl bg-rose-950/90 px-2 py-1 shadow-lg border border-rose-800/70 text-rose-300">
                <InfinityIcon className="h-3 w-3 text-rose-400" />
                <span className="font-pixel text-[9px] tracking-wider">
                  INFINITO
                </span>
              </div>
            ) : null}

            <div className="flex items-center gap-1 rounded-xl bg-slate-950/90 px-2 py-1 shadow-lg border border-slate-800">
              <Zap className="h-3 w-3 text-cyan-400" />
              <span className="font-pixel text-[9px] text-cyan-300 tracking-wider">
                LVL {level}
              </span>
            </div>
          </div>

          {/* Right: Sound Toggle */}
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl bg-slate-950/90 p-1 shadow-lg border border-slate-800">
            <button
              onClick={onToggleMute}
              className="rounded-lg bg-slate-900 p-1.5 text-slate-300 hover:text-white transition active:scale-95"
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5 text-slate-300" />}
            </button>
          </div>
        </div>

        {/* TOP CENTER: "HACERSE EL DORMIDO" BUTTON (CONDITION: MUST AIM AT CUCO IN ROOM) */}
        <div className="pointer-events-auto flex flex-col items-center w-full max-w-sm px-2">
          <button
            onPointerDown={canSleep || isSleeping ? onSleepStart : undefined}
            onPointerUp={onSleepEnd}
            onPointerLeave={onSleepEnd}
            disabled={!canSleep && !isSleeping}
            className={`w-full flex items-center justify-center gap-3 rounded-2xl py-3 px-4 shadow-2xl transition-all select-none ${
              isSleeping
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-2 border-indigo-300 scale-95 shadow-indigo-500/50 ring-4 ring-indigo-500/30'
                : canSleep
                ? 'bg-gradient-to-r from-rose-600 via-indigo-600 to-purple-600 text-white border-2 border-yellow-300 shadow-rose-600/50 animate-pulse active:scale-95 cursor-pointer ring-2 ring-yellow-400/50'
                : lookingAtConsole
                ? 'bg-slate-950/80 text-slate-500 border border-slate-800 opacity-60 cursor-not-allowed'
                : 'bg-slate-950/90 text-amber-300/80 border border-amber-500/30 opacity-75 cursor-not-allowed'
            }`}
          >
            {isSleeping ? (
              <>
                <EyeOff className="h-6 w-6 text-indigo-200 animate-pulse" />
                <div className="flex flex-col items-start leading-tight">
                  <span className="font-pixel text-xs sm:text-sm tracking-wider text-white">
                    ¡DURMIENDO! (SOLTAR PARA VER)
                  </span>
                  <span className="text-[10px] text-indigo-200 font-sans-modern">
                    Ojos cerrados · El Cuco retrocede
                  </span>
                </div>
              </>
            ) : canSleep ? (
              <>
                <ShieldAlert className="h-6 w-6 text-yellow-300 animate-bounce" />
                <div className="flex flex-col items-start leading-tight text-left">
                  <span className="font-pixel text-xs sm:text-sm tracking-wider text-white">
                    ¡MANTÉN: HACERSE EL DORMIDO!
                  </span>
                  <span className="text-[10px] text-yellow-200 font-sans-modern font-semibold">
                    ¡Cuco en la linterna! Cierra los ojos ya
                  </span>
                </div>
              </>
            ) : lookingAtConsole ? (
              <>
                <Gamepad2 className="h-5 w-5 text-slate-500" />
                <div className="flex flex-col items-start leading-tight text-left">
                  <span className="font-pixel text-[11px] text-slate-400">
                    JUGANDO EN CONSOLA
                  </span>
                  <span className="text-[9.5px] text-slate-500 font-sans-modern">
                    Para dormir, levanta la vista y mira la habitación
                  </span>
                </div>
              </>
            ) : (
              <>
                <Flashlight className="h-5 w-5 text-amber-400 animate-pulse" />
                <div className="flex flex-col items-start leading-tight text-left">
                  <span className="font-pixel text-[11px] text-amber-300">
                    APUNTA AL CUCO CON LA LINTERNA
                  </span>
                  <span className="text-[9.5px] text-slate-400 font-sans-modern">
                    Ilumínalo hasta que parpadee la luz para poder dormirte
                  </span>
                </div>
              </>
            )}
          </button>

          {/* Intuitive Sleep Progress Bar - ALWAYS VISIBLE EVEN WHEN SLEEPING */}
          <div className="mt-1.5 w-full rounded-xl bg-slate-950/95 p-2 shadow-2xl border border-slate-800/90 ring-1 ring-black">
            <div className="flex items-center justify-between text-[9px] uppercase font-sans-modern font-bold tracking-wide">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Moon className={`h-3 w-3 ${isHighBoredom ? 'text-amber-400' : 'text-indigo-400'}`} />
                <span>Nivel de Sueño:</span>
                {isSleeping && (
                  <span className="ml-1 text-[8px] text-indigo-300 font-normal font-sans-modern bg-indigo-950 px-1.5 py-0.5 rounded-full border border-indigo-700/50">
                    Avanzando lento...
                  </span>
                )}
              </span>
              <span
                className={`font-pixel text-[9px] flex items-center gap-1 ${
                  isHighBoredom ? 'text-red-400 animate-pulse' : boredom > 35 ? 'text-amber-400' : 'text-cyan-400'
                }`}
              >
                {isHighBoredom ? '¡QUEDÁNDOTE DORMIDO!' : boredom > 35 ? 'SOMNOLIENTO' : 'DESPIERTO'}
                <span className="text-[8px] font-mono text-slate-400">({Math.round(boredom)}%)</span>
              </span>
            </div>

            {/* Smooth intuitive segmented progress bar */}
            <div className="mt-1 relative h-2.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
              <div
                className={`h-full transition-all duration-150 rounded-full ${
                  isHighBoredom
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                    : boredom > 35
                    ? 'bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-500'
                    : 'bg-gradient-to-r from-cyan-400 to-indigo-500'
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
};
