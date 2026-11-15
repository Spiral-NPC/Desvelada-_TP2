/**
 * Victory Screen when player defeats the Level 15 Crowned Final Boss in Classic mode.
 */

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Crown, Award, ShieldCheck, RotateCcw, Home } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-slate-950 p-6 text-center text-slate-100 shadow-2xl border-2 border-[#f4b637]/60">
        {/* Glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 h-24 w-48 rounded-full bg-[#f4b637]/30 blur-3xl" />

        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f4b637]/15 border border-[#f4b637]/60">
          <Crown className="h-9 w-9 text-[#f4b637]" />
        </div>

        <h2 className="font-pixel text-base sm:text-lg tracking-wider text-[#f4b637]">
          ¡VICTORIA! NIVEL 15 SUPERADO
        </h2>

        <p className="mt-2 text-xs text-slate-300 font-sans-modern">
          ¡Derrotaste al Jefe Final con corona en la consola portátil y sobreviviste toda la noche frente al Cuco!
        </p>

        {/* Stats */}
        <div className="my-5 grid grid-cols-2 gap-3 rounded-2xl bg-slate-900/70 p-3.5 border border-[#f4b637]/25 text-left font-sans-modern">
          <div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Award className="h-3.5 w-3.5 text-[#f4b637]" />
              Puntuación Total
            </div>
            <div className="font-pixel text-sm text-[#f4b637] mt-1">
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
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#f4b637] hover:bg-[#f7c55c] py-3 font-pixel text-xs font-bold text-slate-950 shadow-[0_4px_18px_rgba(244,182,55,0.4)] active:scale-95 transition cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>JUGAR OTRA PARTIDA</span>
          </button>

          {onMainMenu && (
            <button
              onClick={onMainMenu}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 py-2.5 font-pixel text-[11px] text-slate-200 border border-slate-700 active:scale-95 transition cursor-pointer"
            >
              <Home className="h-3.5 w-3.5 text-[#f4b637]" />
              <span>VOLVER AL INICIO</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
