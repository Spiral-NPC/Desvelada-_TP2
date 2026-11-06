/**
 * Introductory Welcome, Game Mode Selection & Sensor Permissions Modal for Desvelada.
 * - Allows picking between "Modo Clásico" (Sobrevivir hasta 6:00 AM) and "Modo Infinito" (Noche eterna, varios Cucos, más lugares).
 * - Complies with SDD sensor onboarding flow and iOS 13+ permission requirements.
 */

import React, { useState } from 'react';
import {
  Moon,
  Clock,
  Infinity as InfinityIcon,
  Flame,
  Gamepad2,
  Eye,
  AlertTriangle,
  Play,
  Smartphone,
  Touchpad,
} from 'lucide-react';
import { SensorStatus, GameMode, GameStats } from '../types';
import { soundEngine } from '../audio/SoundEngine';

interface PermissionsModalProps {
  onStartGame: (options: { mode: GameMode }) => void;
  sensorStatus: SensorStatus;
  lossNotice?: 'cuco' | 'sleep' | null;
  lastStats?: GameStats;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  onStartGame,
  lossNotice,
  lastStats,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('classic');
  const [step, setStep] = useState<'welcome' | 'instructions'>('welcome');

  const triggerMenuMusic = () => {
    soundEngine.init();
    if (!soundEngine.isGameOverPlaying()) {
      soundEngine.playAmbienteMusic();
    }
  };

  const handleStart = async () => {
    // Attempt landscape screen orientation lock if supported on mobile
    if (typeof window !== 'undefined' && 'screen' in window && window.screen.orientation) {
      const screenAny = window.screen.orientation as unknown as { lock?: (o: string) => Promise<void> };
      if (typeof screenAny.lock === 'function') {
        screenAny.lock('landscape').catch(() => {});
      }
    }

    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}

    onStartGame({
      mode: selectedMode,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md overflow-y-auto"
      onPointerDown={triggerMenuMusic}
    >
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

            {/* Defeat Banner (when returned to menu after losing) */}
            {lossNotice && (
              <div
                className={`rounded-2xl p-3 text-left border shadow-lg animate-in fade-in ${
                  lossNotice === 'cuco'
                    ? 'bg-red-950/70 border-red-600/60 text-red-200'
                    : 'bg-indigo-950/70 border-indigo-600/60 text-indigo-200'
                }`}
              >
                <div className="flex items-center gap-2 font-pixel text-xs text-white">
                  {lossNotice === 'cuco' ? '💀 ¡EL CUCO TE ATRAPÓ!' : '🌙 ¡TE QUEDASTE DORMIDO!'}
                </div>
                <div className="text-[10px] text-slate-300 font-sans-modern mt-1 leading-snug">
                  {lossNotice === 'cuco'
                    ? 'El monstruo te sorprendió. Has vuelto al menú principal y todos los estados del juego se han reiniciado.'
                    : 'El medidor de sueño llegó al 100%. Has vuelto al menú principal y todos los estados del juego se han reiniciado.'}
                </div>
                {lastStats && (
                  <div className="mt-2 flex items-center justify-between text-[9px] font-pixel text-slate-400 bg-black/50 px-2 py-1 rounded-lg">
                    <span>Puntuación: {lastStats.score} pts</span>
                    <span>Hora: {lastStats.currentHour === 0 ? '12 AM' : `${lastStats.currentHour} AM`}</span>
                    <span>Burlados: {lastStats.monstersRepelled}</span>
                  </div>
                )}
              </div>
            )}

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
            {/* Tactile Controls Info */}
            <div className="space-y-2 text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans-modern">
                Control de Cámara:
              </span>

              <div className="flex items-center gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 p-2.5">
                <div className="rounded-lg bg-emerald-950/60 p-1.5 text-emerald-400 border border-emerald-800/40">
                  <Touchpad className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white font-sans-modern">
                    Controles 100% Táctiles
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Desliza tu dedo o ratón para mover la linterna por la habitación
                  </div>
                </div>
              </div>
            </div>

            {/* Mandatory Landscape Warning Banner for Mobile & Tablets */}
            <div className="flex items-center gap-2.5 rounded-2xl bg-amber-950/60 border border-amber-500/50 p-2.5 text-left font-sans-modern">
              <div className="rounded-xl bg-amber-500/20 p-2 text-amber-400 shrink-0">
                <Smartphone className="h-4 w-4 rotate-90" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-amber-300">
                  📱 Aviso obligatorio en móviles y tablets:
                </div>
                <div className="text-[10px] text-slate-300 leading-tight">
                  Se juega exclusivamente en <strong>Modo Horizontal</strong>. Gira tu dispositivo antes de comenzar.
                </div>
              </div>
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
                  <strong className="text-white">1. Medidor de Sueño y Consola:</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Al pasar tiempo sin jugar te quedas dormido. Jugar en Space Invaders drena el sueño. <strong className="text-pink-300">Al jugar en la consola NO puedes hacerte el dormido.</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl bg-slate-900/60 p-2.5 border border-slate-800">
                <Eye className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="text-white">2. Apuntar al Cuco con la linterna:</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Levanta la vista y recorre la habitación. Para poder hacerte el dormido, <strong className="text-amber-300">debes apuntar la linterna hacia el Cuco</strong>. ¡La linterna comenzará a parpadear para alertarte!
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl bg-slate-900/60 p-2.5 border border-slate-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <div>
                  <strong className="text-white">3. Hacerse el Dormido:</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Cuando veas al Cuco y parpadee tu linterna, mantén <span className="text-indigo-300 font-bold">HACERSE EL DORMIDO</span>. La barra de sueño seguirá visible y continuará avanzando un poco más lento hasta que el Cuco se aleje.
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
