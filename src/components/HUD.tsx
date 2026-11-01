/**
 * Top HUD and Bottom Action Dock for Desvelada.
 * Displays sleep/boredom gauge, hour progression, sensor badges, and "Fingir Dormir" action.
 */

import React from 'react';
import {
  Compass,
  Camera,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Gamepad2,
  Moon,
  Clock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { MiniGameType, SensorStatus } from '../types';

interface HUDProps {
  boredom: number; // 0 to 100
  timeString: string;
  gameTimeSeconds: number;
  lookingAtConsole: boolean;
  isSleeping: boolean;
  onSleepStart: () => void;
  onSleepEnd: () => void;
  onToggleLook: () => void;
  currentMinigame: MiniGameType;
  onChangeMinigame: (type: MiniGameType) => void;
  sensorStatus: SensorStatus;
  onToggleGyro: () => void;
  onToggleCamera: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  cucoWarning: boolean;
}

export const HUD: React.FC<HUDProps> = ({
  boredom,
  timeString,
  lookingAtConsole,
  isSleeping,
  onSleepStart,
  onSleepEnd,
  onToggleLook,
  currentMinigame,
  onChangeMinigame,
  sensorStatus,
  onToggleGyro,
  onToggleCamera,
  isMuted,
  onToggleMute,
  cucoWarning,
}) => {
  const isHighBoredom = boredom > 75;

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-3 select-none">
      {/* --- TOP BAR --- */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Clock & Night Progression */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-slate-950/85 px-3 py-2 text-white shadow-lg border border-slate-800">
          <Clock className="h-4 w-4 text-rose-400" />
          <span className="font-pixel text-xs tracking-wider text-rose-300">
            {timeString}
          </span>
          <span className="text-[10px] text-slate-400 font-sans-modern border-l border-slate-800 pl-2">
            Meta: 6:00 AM
          </span>
        </div>

        {/* Center: Boredom / Sleep Meter ("Barra de Aburrimiento") */}
        <div className="pointer-events-auto flex flex-1 max-w-xs flex-col rounded-xl bg-slate-950/85 px-3 py-1.5 shadow-lg border border-slate-800 mx-2">
          <div className="flex items-center justify-between text-[10px] uppercase font-sans-modern font-semibold">
            <span className="flex items-center gap-1 text-slate-300">
              <Moon className="h-3 w-3 text-indigo-400" />
              Sueño / Aburrimiento
            </span>
            <span
              className={`font-pixel text-[9px] ${
                isHighBoredom ? 'text-red-400 animate-pulse' : 'text-cyan-400'
              }`}
            >
              {Math.round(boredom)}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-200 ${
                isHighBoredom
                  ? 'bg-gradient-to-r from-amber-500 to-red-500'
                  : boredom > 45
                  ? 'bg-gradient-to-r from-cyan-500 to-amber-400'
                  : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, boredom))}%` }}
            />
          </div>
          {isHighBoredom && (
            <span className="text-[9px] text-red-400 text-center font-sans-modern mt-0.5 animate-pulse">
              ¡Jugá con la consola o te dormirás!
            </span>
          )}
        </div>

        {/* Right: Sensor Badges & Quick Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl bg-slate-950/85 p-1.5 shadow-lg border border-slate-800">
          {/* Gyroscope */}
          <button
            onClick={onToggleGyro}
            title={sensorStatus.gyroscopeActive ? 'Giroscopio Activado' : 'Activar Giroscopio'}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-sans-modern transition ${
              sensorStatus.gyroscopeActive
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/60'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Giroscopio</span>
          </button>

          {/* AR Camera Toggle */}
          <button
            onClick={onToggleCamera}
            title={sensorStatus.cameraActive ? 'Modo AR Activado' : 'Activar Cámara AR'}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-sans-modern transition ${
              sensorStatus.cameraActive
                ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AR</span>
          </button>

          {/* Sound Mute */}
          <button
            onClick={onToggleMute}
            className="rounded-lg bg-slate-900 p-1.5 text-slate-300 hover:text-white transition"
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5 text-slate-300" />}
          </button>
        </div>
      </div>

      {/* --- CUCO DANGER FLASH BANNER --- */}
      {cucoWarning && (
        <div className="pointer-events-none mx-auto flex items-center gap-2 rounded-xl bg-red-950/90 px-4 py-2 border border-red-600/80 text-red-200 shadow-2xl animate-bounce">
          <AlertTriangle className="h-5 w-5 text-red-400 animate-pulse" />
          <span className="font-pixel text-[11px] tracking-wider text-white">
            ¡EL CUCO TE ACECHA! ¡HAZTE EL DORMIDO!
          </span>
        </div>
      )}

      {/* --- BOTTOM ACTION DOCK --- */}
      <div className="flex flex-col items-center gap-1.5 w-full pb-1">
        {/* Minigame selector pills (when looking down at console) */}
        {lookingAtConsole && (
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-slate-950/90 px-2.5 py-1 shadow-xl border border-slate-800">
            <span className="text-[9px] text-slate-400 font-pixel mr-1 hidden sm:inline">
              CARTUCHO:
            </span>
            {(['flappy', 'space', 'maze'] as MiniGameType[]).map((type) => {
              const labels = {
                flappy: 'Flappy',
                space: 'Invasores',
                maze: 'Laberinto',
              };
              const active = currentMinigame === type;
              return (
                <button
                  key={type}
                  onClick={() => onChangeMinigame(type)}
                  className={`rounded-full px-2.5 py-0.5 text-[9px] font-sans-modern font-semibold transition ${
                    active
                      ? 'bg-pink-600 text-white shadow-md'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {labels[type]}
                </button>
              );
            })}
          </div>
        )}

        {/* Action Controls Row */}
        <div className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-2">
          {/* Look Up / Look Down Toggle Button */}
          <button
            onClick={onToggleLook}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900/90 px-3 py-2 text-[11px] font-sans-modern font-bold text-slate-200 shadow-xl border border-slate-700 hover:bg-slate-800 active:scale-95 transition"
          >
            {lookingAtConsole ? (
              <>
                <Eye className="h-3.5 w-3.5 text-cyan-400" />
                <span>Habitación</span>
              </>
            ) : (
              <>
                <Gamepad2 className="h-3.5 w-3.5 text-pink-400" />
                <span>Consola</span>
              </>
            )}
          </button>

          {/* "FINGIR DORMIR" (FEIGN SLEEP) BUTTON */}
          <button
            onPointerDown={onSleepStart}
            onPointerUp={onSleepEnd}
            onPointerLeave={onSleepEnd}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 shadow-2xl transition active:scale-95 ${
              isSleeping
                ? 'bg-indigo-600 text-white border-2 border-indigo-400 scale-95 shadow-indigo-500/50'
                : cucoWarning
                ? 'bg-red-600 hover:bg-red-500 text-white border-2 border-red-400 animate-pulse'
                : 'bg-indigo-950/90 hover:bg-indigo-900 text-indigo-100 border border-indigo-700/60'
            }`}
          >
            {isSleeping ? (
              <>
                <EyeOff className="h-4 w-4 text-indigo-200" />
                <span className="font-pixel text-[10px] tracking-wider">
                  DURMIENDO...
                </span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-indigo-300" />
                <div className="flex flex-col items-center">
                  <span className="font-pixel text-[10px] tracking-wider text-white">
                    MANTÉN: FINGIR DORMIR
                  </span>
                  <span className="text-[8px] text-indigo-200/80 font-sans-modern">
                    Tapa tus ojos con la frazada
                  </span>
                </div>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
