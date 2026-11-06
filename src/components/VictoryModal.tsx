/**
 * Victory Screen when player reaches 6:00 AM dawn.
 */

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Sun, Award, ShieldCheck, RotateCcw, Home } from 'lucide-react';
import { GameStats } from '../types';

interface VictoryModalProps {
  stats: GameStats;
  onRestart: () => void;
  onMainMenu?: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({ stats, onRestart, onMainMenu }) => {
  useEffect(() => {
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-slate-950 p-6 text-center text-slate-100 shadow-2xl border border-amber-500/40">
        {/* Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 h-24 w-48 rounded-full bg-amber-500/30 blur-3xl" />

        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-950/70 border border-amber-500/50">
          <Sun className="h-9 w-9 text-amber-400 animate-spin-slow" />
        </div>

        <h2 className="font-pixel text-lg tracking-wider text-amber-300">
          ¡6:00 AM - AMANECIÓ!
        </h2>

        <p className="mt-2 text-xs text-slate-300 font-sans-modern">
          ¡Sobreviviste toda la desvelada! Los rayos del sol entran por tu ventana y el Cuco ha desaparecido.
        </p>

        {/* Stats */}
        <div className="my-5 grid grid-cols-2 gap-3 rounded-2xl bg-slate-900/60 p-3.5 border border-slate-800 text-left font-sans-modern">
          <div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Award className="h-3.5 w-3.5 text-amber-400" />
              Puntuación Total
            </div>
            <div className="font-pixel text-sm text-amber-300 mt-1">
              {stats.score}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Cucos Burlados
            </div>
            <div className="font-pixel text-sm text-emerald-300 mt-1">
              {stats.monstersRepelled}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-pink-600 py-3 font-pixel text-xs font-bold text-white shadow-xl hover:opacity-95 active:scale-95 transition"
          >
            <RotateCcw className="h-4 w-4" />
            <span>JUGAR OTRA NOCHE</span>
          </button>

          {onMainMenu && (
            <button
              onClick={onMainMenu}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 py-2.5 font-pixel text-[11px] text-slate-300 border border-slate-700 active:scale-95 transition"
            >
              <Home className="h-3.5 w-3.5 text-slate-400" />
              <span>VOLVER AL INICIO</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
