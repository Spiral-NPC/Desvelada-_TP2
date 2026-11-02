/**
 * Game Over Modal for Desvelada.
 * Shows creepy jumpscare or falling asleep outcome, with survival stats and restart button.
 */

import React from 'react';
import { Skull, Moon, RotateCcw, Award, Clock, ShieldCheck } from 'lucide-react';
import { GameStats } from '../types';

interface GameOverModalProps {
  reason: 'jumpscare' | 'slept';
  stats: GameStats;
  onRestart: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  reason,
  stats,
  onRestart,
}) => {
  const isJumpscare = reason === 'jumpscare';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md select-none ${
        isJumpscare ? 'bg-red-950/85' : 'bg-slate-950/90'
      }`}
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-black/90 p-6 text-center text-slate-100 shadow-2xl border border-red-900/50">
        {/* Glow */}
        <div
          className={`absolute -top-10 left-1/2 -translate-x-1/2 h-20 w-40 rounded-full blur-3xl ${
            isJumpscare ? 'bg-red-600/40' : 'bg-indigo-600/30'
          }`}
        />

        {/* Icon & Title */}
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800">
          {isJumpscare ? (
            <Skull className="h-9 w-9 text-red-500 animate-pulse" />
          ) : (
            <Moon className="h-9 w-9 text-indigo-400" />
          )}
        </div>

        <h2 className="font-pixel text-xl tracking-wider text-red-400">
          {isJumpscare ? '¡TE COMIÓ EL CUCO!' : '¡TE QUEDASTE DORMIDO!'}
        </h2>

        <p className="mt-2 text-xs text-slate-300 font-sans-modern">
          {isJumpscare
            ? 'El monstruo te atrapó porque no fingiste estar dormido a tiempo.'
            : 'Tu aburrimiento llegó al límite y caíste en un profundo sueño.'}
        </p>

        {/* Stats Grid */}
        <div className="my-5 grid grid-cols-4 gap-2 rounded-2xl bg-slate-900/60 p-3 border border-slate-800 text-left font-sans-modern">
          <div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Clock className="h-3 w-3 text-rose-400" />
              Hora
            </div>
            <div className="font-pixel text-[10px] text-white mt-1">
              {stats.currentHour === 0 ? '12 AM' : `${stats.currentHour} AM`}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Award className="h-3 w-3 text-cyan-400" />
              Nivel
            </div>
            <div className="font-pixel text-[10px] text-cyan-300 mt-1">
              {stats.level}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Award className="h-3 w-3 text-amber-400" />
              Puntos
            </div>
            <div className="font-pixel text-[10px] text-amber-300 mt-1">
              {stats.score}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              Burlados
            </div>
            <div className="font-pixel text-[10px] text-emerald-300 mt-1">
              {stats.monstersRepelled}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onRestart}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-pink-600 py-3.5 font-pixel text-xs font-bold text-white shadow-xl hover:opacity-95 active:scale-95 transition"
        >
          <RotateCcw className="h-4 w-4" />
          <span>REINTENTAR DESVELADA</span>
        </button>
      </div>
    </div>
  );
};
