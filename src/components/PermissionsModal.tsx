/**
 * Introductory Welcome, Game Mode Selection & Sensor Permissions Modal for Desvelada.
 * - Allows picking between "Modo Clásico" (Sobrevivir hasta 6:00 AM) and "Modo Infinito" (Noche eterna, varios Cucos, más lugares).
 * - Complies with SDD sensor onboarding flow and iOS 13+ permission requirements.
 */

import React, { useState } from 'react';
import {
  Compass,
  Camera,
  Moon,
  Clock,
  Infinity as InfinityIcon,
  Flame,
  Gamepad2,
  Eye,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { SensorStatus, GameMode } from '../types';

interface PermissionsModalProps {
  onStartGame: (options: { enableGyro: boolean; enableCamera: boolean; mode: GameMode }) => void;
  sensorStatus: SensorStatus;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  onStartGame,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('classic');
  const [requestGyro, setRequestGyro] = useState(true);
  const [requestCamera, setRequestCamera] = useState(false);
  const [step, setStep] = useState<'welcome' | 'instructions'>('welcome');

  const handleStart = async () => {
    // Attempt landscape screen orientation lock if supported on mobile
    if (typeof window !== 'undefined' && 'screen' in window && window.screen.orientation) {
      const screenAny = window.screen.orientation as unknown as { lock?: (o: string) => Promise<void> };
      if (typeof screenAny.lock === 'function') {
        screenAny.lock('landscape').catch(() => {});
      }
    }

    onStartGame({
      enableGyro: requestGyro,
      enableCamera: requestCamera,
      mode: selectedMode,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md rounded-3xl bg-slate-950 p-6 text-slate-100 shadow-2xl border border-slate-800">
        {/* Glow accent */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 h-24 w-48 rounded-full bg-pink-600/20 blur-3xl pointer-events-none" />

        {step === 'welcome' ? (
          <div className="space-y-4 text-center">
            {/* Title & Badge */}
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-pink-950/70 px-3 py-1 text-xs font-semibold text-pink-400 border border-pink-800/60 mb-2">
                <Moon className="h-3.5 w-3.5" />
                <span>EXPERIENCIA WEB INMERSIVA</span>
              </div>
              <h1 className="font-pixel text-2xl tracking-wider text-white">
                DESVELADA
              </h1>
              <p className="mt-1 font-retro text-xl text-slate-400">
                {selectedMode === 'classic' ? 'SOBREVIVE HASTA LAS 6:00 AM' : 'NOCHE ETERNA: PUNTUACIÓN MÁXIMA'}
              </p>
            </div>

            {/* --- GAME MODE SELECTOR --- */}
            <div className="text-left space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans-modern flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-amber-400" />
                Elige Modo de Juego:
              </span>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Modo Clásico */}
                <button
                  type="button"
                  onClick={() => setSelectedMode('classic')}
                  className={`flex flex-col text-left p-3 rounded-2xl border transition relative ${
                    selectedMode === 'classic'
                      ? 'bg-indigo-950/90 border-indigo-500 shadow-lg shadow-indigo-500/20'
                      : 'bg-slate-900/50 border-slate-800 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Clock className={`h-4 w-4 ${selectedMode === 'classic' ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <span className="font-pixel text-[9px] text-indigo-300">6:00 AM</span>
                  </div>
                  <div className="font-pixel text-xs text-white">
                    CLÁSICO
                  </div>
                  <div className="text-[10px] text-slate-300 mt-1 font-sans-modern leading-tight">
                    Resiste de 12 AM a 6 AM. 1 Cuco sigiloso.
                  </div>
                </button>

                {/* Modo Infinito */}
                <button
                  type="button"
                  onClick={() => setSelectedMode('infinite')}
                  className={`flex flex-col text-left p-3 rounded-2xl border transition relative ${
                    selectedMode === 'infinite'
                      ? 'bg-rose-950/90 border-rose-500 shadow-lg shadow-rose-500/20'
                      : 'bg-slate-900/50 border-slate-800 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <InfinityIcon className={`h-4 w-4 ${selectedMode === 'infinite' ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
                    <span className="font-pixel text-[9px] text-rose-300">RÉCORD</span>
                  </div>
                  <div className="font-pixel text-xs text-white">
                    INFINITO
                  </div>
                  <div className="text-[10px] text-slate-300 mt-1 font-sans-modern leading-tight">
                    Sin fin. Múltiples Cucos, 10 escondites y más frenético.
                  </div>
                </button>
              </div>
            </div>

            {/* Sensor Permissions Preferences */}
            <div className="space-y-2 text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans-modern">
                Sensores del Dispositivo (Opcional):
              </span>

              {/* Gyroscope toggle */}
              <label className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-2.5 cursor-pointer hover:bg-slate-900/70 transition">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-emerald-950/60 p-1.5 text-emerald-400 border border-emerald-800/40">
                    <Compass className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white font-sans-modern">
                      Giroscopio / Movimiento 360°
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Gira tu teléfono físicamente para mirar alrededor
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={requestGyro}
                  onChange={(e) => setRequestGyro(e.target.checked)}
                  className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                />
              </label>

              {/* Camera AR toggle */}
              <label className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-2.5 cursor-pointer hover:bg-slate-900/70 transition">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-indigo-950/60 p-1.5 text-indigo-400 border border-indigo-800/40">
                    <Camera className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white font-sans-modern">
                      Modo Realidad Aumentada (Cámara)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Usa tu cámara real como fondo de la habitación
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={requestCamera}
                  onChange={(e) => setRequestCamera(e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-500 cursor-pointer"
                />
              </label>
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setStep('instructions')}
                className="flex-1 rounded-2xl bg-slate-800 py-3 text-xs font-bold text-slate-200 hover:bg-slate-700 transition font-sans-modern"
              >
                ¿Cómo Jugar?
              </button>
              <button
                onClick={handleStart}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-indigo-600 py-3 font-pixel text-xs font-bold text-white shadow-xl hover:opacity-90 active:scale-95 transition"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>JUGAR</span>
              </button>
            </div>
          </div>
        ) : (
          /* Instructions Screen */
          <div className="space-y-3.5">
            <h2 className="font-pixel text-sm text-pink-400 tracking-wider">
              REGLAS DE SUPERVIVENCIA
            </h2>

            <div className="space-y-2.5 text-xs font-sans-modern text-slate-300">
              <div className="flex items-start gap-2.5 rounded-xl bg-slate-900/60 p-2.5 border border-slate-800">
                <Gamepad2 className="h-4 w-4 shrink-0 text-cyan-400 mt-0.5" />
                <div>
                  <strong className="text-white">1. Medidor de Sueño (10 Segundos):</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Al pasar <strong className="text-cyan-300">10 segundos sin jugar en la consola</strong>, te quedas dormido y pierdes. Jugar en Space Invaders drena el sueño.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl bg-slate-900/60 p-2.5 border border-slate-800">
                <Eye className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="text-white">2. Habitación a oscuras y linterna:</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Al levantar la vista, la consola se pausa automáticamente. Usa la linterna de radio estrecho para alumbrar los rincones de la habitación.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl bg-slate-900/60 p-2.5 border border-slate-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <div>
                  <strong className="text-white">3. El Cuco y Modo Infinito:</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    El Cuco no hace ruido ni avisa con interfaz. Si lo ves acechando, mantén <span className="text-indigo-300 font-bold">FINGIR DORMIR</span> con la frazada. En modo Infinito pueden aparecer varios a la vez en 10 escondites distintos.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setStep('welcome')}
                className="flex-1 rounded-2xl bg-slate-800 py-3 text-xs font-bold text-slate-200 hover:bg-slate-700 transition font-sans-modern"
              >
                Volver
              </button>
              <button
                onClick={handleStart}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-indigo-600 py-3 font-pixel text-xs font-bold text-white shadow-xl hover:opacity-90 active:scale-95 transition"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>INICIAR</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
