/**
 * Introductory Welcome & Game Mode Selection Modal for Desvelada.
 * - Allows picking between "Modo Clásico" (Superar el Nivel 15) and "Modo Infinito" (Noche eterna, varios Cucos).
 * - Uses 100% tactile controls without requiring any camera or gyroscope permissions.
 */

import React, { useState } from 'react';
import {
  Moon,
  Trophy,
  Infinity as InfinityIcon,
  Flame,
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
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('classic');

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4 overflow-y-auto"
      onPointerDown={triggerMenuMusic}
    >
      <div className="relative w-full max-w-md rounded-3xl bg-slate-950 p-6 text-slate-100 shadow-2xl border border-[#f4b637]/30">
        {/* Glow accent */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 h-24 w-48 rounded-full bg-[#f4b637]/20 blur-3xl pointer-events-none" />

        <div className="space-y-4 text-center">
          {/* Title & Badge */}
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#f4b637]/15 px-3 py-1 text-xs font-semibold text-[#f4b637] border border-[#f4b637]/40 mb-2">
              <Moon className="h-3.5 w-3.5" />
              <span>EXPERIENCIA WEB INMERSIVA</span>
            </div>
            <h1 className="font-pixel text-2xl tracking-wider text-[#f4b637]">
              DESVELADA
            </h1>
            <p className="mt-1 font-retro text-xl text-slate-300">
              {selectedMode === 'classic' ? 'SUPERA EL NIVEL 15 PARA GANAR' : 'NOCHE ETERNA: PUNTUACIÓN MÁXIMA'}
            </p>
          </div>

          {/* Defeat Banner (when returned to menu after losing) */}
          {lossNotice && (
            <div
              data-testid="loss-banner"
              className="rounded-2xl p-3.5 text-center border bg-red-950/70 border-red-600/60 text-red-200 shadow-lg"
            >
              <div className="font-pixel text-sm text-white tracking-wider">
                Perdiste
              </div>
              <div className="text-xs text-red-200/90 font-sans-modern mt-1">
                Presta más atención la próxima
              </div>
            </div>
          )}

          {/* --- GAME MODE SELECTOR --- */}
          <div className="text-left space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#f4b637] font-sans-modern flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-[#f4b637]" />
              Elige Modo de Juego:
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Modo Clásico */}
              <button
                type="button"
                onClick={() => setSelectedMode('classic')}
                className={`flex flex-col text-left p-3 rounded-2xl border transition relative cursor-pointer ${
                  selectedMode === 'classic'
                    ? 'bg-[#f4b637]/15 border-[#f4b637] shadow-lg shadow-[#f4b637]/15'
                    : 'bg-slate-900/50 border-slate-800 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Trophy className={`h-4 w-4 ${selectedMode === 'classic' ? 'text-[#f4b637]' : 'text-slate-500'}`} />
                  <span className={`font-pixel text-[9px] ${selectedMode === 'classic' ? 'text-[#f4b637]' : 'text-slate-400'}`}>
                    NIVEL 15
                  </span>
                </div>
                <div className="font-pixel text-xs text-white">
                  CLÁSICO
                </div>
                <div className="text-[10px] text-slate-300 mt-1 font-sans-modern leading-tight">
                  Llega y vence al Jefe Final del Nivel 15. 1 Cuco sigiloso.
                </div>
              </button>

              {/* Modo Infinito */}
              <button
                type="button"
                onClick={() => setSelectedMode('infinite')}
                className={`flex flex-col text-left p-3 rounded-2xl border transition relative cursor-pointer ${
                  selectedMode === 'infinite'
                    ? 'bg-[#f4b637]/15 border-[#f4b637] shadow-lg shadow-[#f4b637]/15'
                    : 'bg-slate-900/50 border-slate-800 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <InfinityIcon className={`h-4 w-4 ${selectedMode === 'infinite' ? 'text-[#f4b637] animate-pulse' : 'text-slate-500'}`} />
                  <span className={`font-pixel text-[9px] ${selectedMode === 'infinite' ? 'text-[#f4b637]' : 'text-slate-400'}`}>
                    RÉCORD
                  </span>
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

          {/* Tactile Controls Info */}
          <div className="space-y-2 text-left">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans-modern">
              Controles de Vista:
            </span>

            <div className="flex items-center gap-2.5 rounded-xl border border-[#f4b637]/25 bg-slate-900/50 p-2.5">
              <div className="rounded-lg bg-[#f4b637]/15 p-1.5 text-[#f4b637] border border-[#f4b637]/30">
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
          <div className="flex items-center gap-2.5 rounded-2xl bg-[#f4b637]/10 border border-[#f4b637]/40 p-2.5 text-left font-sans-modern">
            <div className="rounded-xl bg-[#f4b637]/20 p-2 text-[#f4b637] shrink-0">
              <Smartphone className="h-4 w-4 rotate-90" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-[#f4b637]">
                📱 Aviso obligatorio en móviles y tablets:
              </div>
              <div className="text-[10px] text-slate-300 leading-tight">
                Se juega exclusivamente en <strong>Modo Horizontal</strong>. Gira tu dispositivo antes de comenzar.
              </div>
            </div>
          </div>

          {/* Start CTA (Tutorial activates automatically on first game) */}
          <div className="pt-1">
            <button
              type="button"
              data-start="true"
              onClick={handleStart}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#f4b637] hover:bg-[#f7c55c] py-3.5 font-pixel text-xs font-bold text-slate-950 shadow-[0_4px_20px_rgba(244,182,55,0.45)] active:scale-95 transition cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>JUGAR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
