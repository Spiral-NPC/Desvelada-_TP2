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
    <div className="pointer-events-none fixed bottom-24 left-0 right-0 z-20 flex items-end justify-between px-4 pb-1 select-none">
      {/* --- D-PAD (Left) --- */}
      <div className="pointer-events-auto relative h-28 w-28">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-24 w-24">
            {/* Up Button */}
            <button
              onPointerDown={() => handleDpad(true, false, false, false)}
              onPointerUp={handleRelease}
              onPointerLeave={handleRelease}
              className="absolute left-8 top-0 flex h-8 w-8 items-center justify-center rounded-t-lg bg-slate-900/95 border border-slate-700 active:bg-pink-600 shadow-lg text-slate-300"
            >
              <ArrowUp className="h-4 w-4" />
            </button>

            {/* Down Button */}
            <button
              onPointerDown={() => handleDpad(false, true, false, false)}
              onPointerUp={handleRelease}
              onPointerLeave={handleRelease}
              className="absolute bottom-0 left-8 flex h-8 w-8 items-center justify-center rounded-b-lg bg-slate-900/95 border border-slate-700 active:bg-pink-600 shadow-lg text-slate-300"
            >
              <ArrowDown className="h-4 w-4" />
            </button>

            {/* Left Button */}
            <button
              onPointerDown={() => handleDpad(false, false, true, false)}
              onPointerUp={handleRelease}
              onPointerLeave={handleRelease}
              className="absolute left-0 top-8 flex h-8 w-8 items-center justify-center rounded-l-lg bg-slate-900/95 border border-slate-700 active:bg-pink-600 shadow-lg text-slate-300"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            {/* Right Button */}
            <button
              onPointerDown={() => handleDpad(false, false, false, true)}
              onPointerUp={handleRelease}
              onPointerLeave={handleRelease}
              className="absolute right-0 top-8 flex h-8 w-8 items-center justify-center rounded-r-lg bg-slate-900/95 border border-slate-700 active:bg-pink-600 shadow-lg text-slate-300"
            >
              <ArrowRight className="h-4 w-4" />
            </button>

            {/* Center block */}
            <div className="absolute left-8 top-8 h-8 w-8 bg-slate-950 border border-slate-800" />
          </div>
        </div>
      </div>

      {/* --- A & B ACTION BUTTONS (Right) --- */}
      <div className="pointer-events-auto flex items-center gap-3">
        {/* B Button */}
        <button
          onPointerDown={() => {
            onButtonBPress();
            soundEngine.triggerHaptic(12);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800/90 border border-slate-600 font-pixel text-[10px] font-bold text-slate-200 shadow-xl active:bg-pink-700 active:scale-95 transition"
        >
          B
        </button>

        {/* A Button (Primary) */}
        <button
          onPointerDown={() => {
            onButtonAPress();
            soundEngine.triggerHaptic(18);
          }}
          className="flex h-13 w-13 -translate-y-2 items-center justify-center rounded-full bg-pink-600 border-2 border-pink-400 font-pixel text-xs font-bold text-white shadow-2xl active:bg-pink-700 active:scale-95 transition shadow-pink-500/40"
        >
          A
        </button>
      </div>
    </div>
  );
};
