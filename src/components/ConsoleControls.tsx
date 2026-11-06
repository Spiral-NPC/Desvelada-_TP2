/**
 * Virtual Retro Console Gamepad overlay.
 * Active when looking down at the handheld console, giving full tactile controls on mobile.
 */

import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';

interface ConsoleControlsProps {
  visible: boolean;
  onDpadChange: (dir: { up: boolean; down: boolean; left: boolean; right: boolean }) => void;
  onButtonAPress: () => void;
  onButtonBPress: () => void;
}

export const ConsoleControls: React.FC<ConsoleControlsProps> = ({
  visible,
  onDpadChange,
  onButtonAPress,
  onButtonBPress,
}) => {
  if (!visible) return null;

  const handleDpad = (up: boolean, down: boolean, left: boolean, right: boolean) => {
    onDpadChange({ up, down, left, right });
    soundEngine.triggerHaptic(10);
  };

  const handleRelease = () => {
    onDpadChange({ up: false, down: false, left: false, right: false });
  };

  return (
    <div className="pointer-events-none fixed bottom-3 sm:bottom-6 left-0 right-0 z-20 flex items-end justify-between px-3 sm:px-8 pb-1 select-none">
      {/* --- ENLARGED D-PAD (Left) --- */}
      <div className="pointer-events-auto relative h-36 w-36 sm:h-44 sm:w-44">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-36 w-36 sm:h-42 sm:w-42">
            {/* Up Button */}
            <button
              onPointerDown={() => handleDpad(true, false, false, false)}
              onPointerUp={handleRelease}
              onPointerLeave={handleRelease}
              aria-label="Arriba"
              className="absolute left-12 sm:left-14 top-0 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-t-2xl bg-slate-900/95 border-2 border-slate-700 active:bg-pink-600 active:border-pink-400 shadow-2xl text-slate-200 transition-colors"
            >
              <ArrowUp className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>

            {/* Down Button */}
            <button
              onPointerDown={() => handleDpad(false, true, false, false)}
              onPointerUp={handleRelease}
              onPointerLeave={handleRelease}
              aria-label="Abajo"
              className="absolute bottom-0 left-12 sm:left-14 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-b-2xl bg-slate-900/95 border-2 border-slate-700 active:bg-pink-600 active:border-pink-400 shadow-2xl text-slate-200 transition-colors"
            >
              <ArrowDown className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>

            {/* Left Button */}
            <button
              onPointerDown={() => handleDpad(false, false, true, false)}
              onPointerUp={handleRelease}
              onPointerLeave={handleRelease}
              aria-label="Izquierda"
              className="absolute left-0 top-12 sm:top-14 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-l-2xl bg-slate-900/95 border-2 border-slate-700 active:bg-pink-600 active:border-pink-400 shadow-2xl text-slate-200 transition-colors"
            >
              <ArrowLeft className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>

            {/* Right Button */}
            <button
              onPointerDown={() => handleDpad(false, false, false, true)}
              onPointerUp={handleRelease}
              onPointerLeave={handleRelease}
              aria-label="Derecha"
              className="absolute right-0 top-12 sm:top-14 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-r-2xl bg-slate-900/95 border-2 border-slate-700 active:bg-pink-600 active:border-pink-400 shadow-2xl text-slate-200 transition-colors"
            >
              <ArrowRight className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>

            {/* Center block */}
            <div className="absolute left-12 sm:left-14 top-12 sm:top-14 h-12 w-12 sm:h-14 sm:w-14 bg-slate-950 border-2 border-slate-800 shadow-inner flex items-center justify-center">
              <div className="h-4 w-4 rounded-full bg-slate-800/80" />
            </div>
          </div>
        </div>
      </div>

      {/* --- ENLARGED A & B ACTION BUTTONS (Right) --- */}
      <div className="pointer-events-auto flex items-end gap-4 sm:gap-6 pb-1">
        {/* B Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onPointerDown={() => {
              onButtonBPress();
              soundEngine.triggerHaptic(12);
            }}
            aria-label="Botón B"
            className="flex h-15 w-15 sm:h-18 sm:w-18 items-center justify-center rounded-full bg-slate-800/95 border-2 border-slate-600 font-pixel text-xs sm:text-sm font-bold text-slate-200 shadow-2xl active:bg-pink-700 active:scale-95 active:border-pink-400 transition"
          >
            B
          </button>
          <span className="font-pixel text-[8px] sm:text-[9px] text-slate-400 tracking-wider">
            REINICIAR
          </span>
        </div>

        {/* A Button (Primary / Fire) */}
        <div className="flex flex-col items-center gap-1">
          <button
            onPointerDown={() => {
              onButtonAPress();
              soundEngine.triggerHaptic(18);
            }}
            aria-label="Botón A Disparo"
            className="flex h-18 w-18 sm:h-22 sm:w-22 -translate-y-2 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 border-2 sm:border-3 border-pink-300 font-pixel text-sm sm:text-base font-bold text-white shadow-[0_0_25px_rgba(236,72,153,0.6)] active:bg-pink-700 active:scale-95 transition ring-2 ring-pink-500/30 cursor-pointer"
          >
            A
          </button>
          <span className="font-pixel text-[9px] sm:text-[10px] text-pink-300 tracking-wider -translate-y-1">
            DISPARO
          </span>
        </div>
      </div>
    </div>
  );
};
