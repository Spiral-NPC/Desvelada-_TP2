/**
 * Eyelids closing / opening animation overlay for Desvelada.
 * Displays realistic top and bottom eyelids sliding together to close the player's eyes
 * when holding the "Hacerse el dormido" button.
 */

import React from 'react';
import { EyeOff } from 'lucide-react';

interface EyelidsOverlayProps {
  isSleeping: boolean;
}

export const EyelidsOverlay: React.FC<EyelidsOverlayProps> = ({ isSleeping }) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden select-none">
      {/* Upper Eyelid */}
      <div
        className="absolute left-0 right-0 top-0 bg-slate-950 transition-all duration-300 ease-in-out border-b-4 border-slate-900 shadow-[0_15px_35px_rgba(0,0,0,0.95)]"
        style={{
          height: isSleeping ? '50%' : '0%',
          borderBottomLeftRadius: isSleeping ? '20% 15px' : '0px',
          borderBottomRightRadius: isSleeping ? '20% 15px' : '0px',
        }}
      >
        {/* Subtle eyelash / dark shadow vignette */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black to-transparent opacity-80" />
      </div>

      {/* Lower Eyelid */}
      <div
        className="absolute left-0 right-0 bottom-0 bg-slate-950 transition-all duration-300 ease-in-out border-t-4 border-slate-900 shadow-[0_-15px_35px_rgba(0,0,0,0.95)]"
        style={{
          height: isSleeping ? '50%' : '0%',
          borderTopLeftRadius: isSleeping ? '20% 15px' : '0px',
          borderTopRightRadius: isSleeping ? '20% 15px' : '0px',
        }}
      >
        {/* Subtle eyelash / dark shadow vignette */}
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black to-transparent opacity-80" />
      </div>

      {/* Center Darkness & Sleeping Visual Cue */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center pt-28 transition-opacity duration-300 ${
          isSleeping ? 'opacity-100 delay-150' : 'opacity-0'
        }`}
      >
        <div className="flex flex-col items-center gap-2 text-indigo-300">
          <div className="flex items-center gap-2">
            <EyeOff className="h-6 w-6 text-indigo-300 animate-pulse" />
            <span className="font-pixel text-lg sm:text-xl tracking-wider text-indigo-200">
              OJOS CERRADOS · FINGIENDO DORMIR
            </span>
          </div>
          <div className="font-retro text-3xl sm:text-4xl text-indigo-400 tracking-widest animate-pulse">
            Z z z . . .
          </div>
          <p className="text-xs text-slate-400 font-sans-modern mt-1 bg-black/60 px-4 py-1.5 rounded-full border border-slate-800">
            No abras los ojos hasta que el Cuco se aleje de tu habitación
          </p>
        </div>
      </div>
    </div>
  );
};
