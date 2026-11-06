/**
 * Top HUD and Action Controls for Desvelada.
 * - "MANTÉN: FINGIR DORMIR" is centered prominently in the top header.
 * - Fast sleep/boredom meter (3-second urgency).
 * - Minimal bottom controls for clean mobile gameplay.
 */

import React from 'react';
import {
  Compass,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Gamepad2,
  Moon,
  Clock,
  Zap,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { SensorStatus, GameMode } from '../types';

interface HUDProps {
  boredom: number; // 0 to 100 (fills in 10 seconds if not playing!)
  timeString: string;
  gameTimeSeconds: number;
  level: number;
  mode?: GameMode;
  lookingAtConsole: boolean;
  isSleeping: boolean;
  onSleepStart: () => void;
  onSleepEnd: () => void;
  onToggleLook: () => void;
  sensorStatus: SensorStatus;
  onToggleGyro: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  boredom,
  timeString,
  level,
  mode = 'classic',
  lookingAtConsole,
  isSleeping,
  onSleepStart,
  onSleepEnd,
  onToggleLook,
  sensorStatus,
  onToggleGyro,
  isMuted,
  onToggleMute,
}) => {
  const isHighBoredom = boredom > 65;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-2 select-none">
      {/* --- TOP HEADER & CONTROLS --- */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        {/* Top bar: Stats and Sensor Badges */}
        <div className="flex w-full items-center justify-between gap-1">
          {/* Left: Clock, Mode & Level */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-xl bg-slate-950/85 px-2.5 py-1 text-white shadow-lg border border-slate-800">
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

            <div className="flex items-center gap-1 rounded-xl bg-slate-950/85 px-2 py-1 shadow-lg border border-slate-800">
              <Zap className="h-3 w-3 text-cyan-400" />
              <span className="font-pixel text-[9px] text-cyan-300 tracking-wider">
                LVL {level}
              </span>
            </div>
          </div>

          {/* Right: Sensor Badges */}
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl bg-slate-950/85 p-1 shadow-lg border border-slate-800">
            <button
              onClick={onToggleGyro}
              title={sensorStatus.gyroscopeActive ? 'Giroscopio Activado' : 'Activar Giroscopio'}
              className={`rounded-lg p-1.5 transition ${
                sensorStatus.gyroscopeActive
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/60'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={onToggleMute}
              className="rounded-lg bg-slate-900 p-1.5 text-slate-300 hover:text-white transition"
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5 text-slate-300" />}
            </button>
          </div>
        </div>

        {/* TOP CENTER: "HACERSE EL DORMIDO" BUTTON (ENLARGED & PROMINENT) */}
        <div className="pointer-events-auto flex flex-col items-center w-full max-w-sm px-2">
          <button
            onPointerDown={onSleepStart}
            onPointerUp={onSleepEnd}
            onPointerLeave={onSleepEnd}
            className={`w-full flex items-center justify-center gap-3 rounded-2xl py-3 px-4 shadow-2xl transition-all active:scale-95 select-none ${
              isSleeping
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-2 border-indigo-300 scale-95 shadow-indigo-500/50 ring-4 ring-indigo-500/30'
                : 'bg-gradient-to-r from-indigo-950/95 to-slate-950/95 hover:from-indigo-900 hover:to-slate-900 text-indigo-100 border-2 border-indigo-500/80 shadow-indigo-950/50'
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
                    Ojos cerrados · El Cuco no te ve
                  </span>
                </div>
              </>
            ) : (
              <>
                <Eye className="h-6 w-6 text-indigo-300" />
                <div className="flex flex-col items-start leading-tight">
                  <span className="font-pixel text-xs sm:text-sm tracking-wider text-white">
                    MANTÉN: HACERSE EL DORMIDO
                  </span>
                  <span className="text-[10px] text-indigo-300/90 font-sans-modern">
                    Tapa tus ojos con la frazada
                  </span>
                </div>
              </>
            )}
          </button>

          {/* Intuitive Sleep Progress Bar without mentioning seconds */}
          <div className="mt-1.5 w-full rounded-xl bg-slate-950/90 p-2 shadow-lg border border-slate-800/90">
            <div className="flex items-center justify-between text-[9px] uppercase font-sans-modern font-bold tracking-wide">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Moon className={`h-3 w-3 ${isHighBoredom ? 'text-amber-400' : 'text-indigo-400'}`} />
                <span>Nivel de Sueño:</span>
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

      {/* --- BOTTOM ACTION BAR --- */}
      <div className="pointer-events-auto flex justify-center pb-2">
        <button
          onClick={onToggleLook}
          className="flex items-center gap-2 rounded-2xl bg-slate-900/90 px-4 py-2.5 text-xs font-sans-modern font-bold text-slate-200 shadow-xl border border-slate-700 hover:bg-slate-800 active:scale-95 transition"
        >
          {lookingAtConsole ? (
            <>
              <Eye className="h-4 w-4 text-cyan-400" />
              <span>Mirar Habitación</span>
            </>
          ) : (
            <>
              <Gamepad2 className="h-4 w-4 text-pink-400" />
              <span>Volver a Consola</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
