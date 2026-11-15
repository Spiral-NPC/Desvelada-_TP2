/**
 * Virtual Retro Console Gamepad overlay.
 * Active when looking down at the handheld console, giving full tactile controls on mobile.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';

interface ConsoleControlsProps {
  visible: boolean;
  onDpadChange: (dir: { up: boolean; down: boolean; left: boolean; right: boolean }) => void;
  onButtonAPress: () => void;
  highlightControls?: boolean;
}

type DpadDir = 'up' | 'down' | 'left' | 'right';

export const ConsoleControls: React.FC<ConsoleControlsProps> = React.memo(({
  visible,
  onDpadChange,
  onButtonAPress,
  highlightControls = false,
}) => {
  const [pressedDir, setPressedDir] = useState<DpadDir | null>(null);
  const [isAPressed, setIsAPressed] = useState<boolean>(false);
  const aReleaseTimer = useRef<number | null>(null);
  const dirReleaseTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (aReleaseTimer.current) window.clearTimeout(aReleaseTimer.current);
      if (dirReleaseTimer.current) window.clearTimeout(dirReleaseTimer.current);
    };
  }, []);

  // Reset visual states if console hides
  useEffect(() => {
    if (!visible) {
      setPressedDir(null);
      setIsAPressed(false);
    }
  }, [visible]);

  if (!visible) return null;

  const handleDpad = (dir: DpadDir) => {
    if (dirReleaseTimer.current) {
      window.clearTimeout(dirReleaseTimer.current);
      dirReleaseTimer.current = null;
    }
    setPressedDir(dir);
    onDpadChange({
      up: dir === 'up',
      down: dir === 'down',
      left: dir === 'left',
      right: dir === 'right',
    });
    soundEngine.triggerHaptic(10);
  };

  const handleRelease = () => {
    onDpadChange({ up: false, down: false, left: false, right: false });
    if (dirReleaseTimer.current) window.clearTimeout(dirReleaseTimer.current);
    // Keep visual depress visible briefly on rapid taps so animation is clearly perceived
    dirReleaseTimer.current = window.setTimeout(() => {
      setPressedDir(null);
    }, 90);
  };

  const handleAPointerDown = () => {
    if (aReleaseTimer.current) {
      window.clearTimeout(aReleaseTimer.current);
      aReleaseTimer.current = null;
    }
    setIsAPressed(true);
    onButtonAPress();
    soundEngine.triggerHaptic(18);
  };

  const handleAPointerUp = () => {
    if (aReleaseTimer.current) window.clearTimeout(aReleaseTimer.current);
    // Guarantee subtle visual press depression completes on quick taps
    aReleaseTimer.current = window.setTimeout(() => {
      setIsAPressed(false);
    }, 110);
  };

  return (
    <div
      data-testid="console-controls"
      className={`pointer-events-none fixed bottom-3 sm:bottom-6 left-0 right-0 flex items-end justify-between px-3 sm:px-8 pb-1 select-none ${
        highlightControls ? 'z-50' : 'z-20'
      }`}
    >
      {/* --- ENLARGED D-PAD (Left) --- */}
      <div
        data-testid="dpad-controls"
        className={`pointer-events-auto relative h-36 w-36 sm:h-44 sm:w-44 rounded-3xl transition-all ${
          highlightControls
            ? 'ring-4 ring-[#f4b637] bg-[#f4b637]/10 shadow-[0_0_28px_rgba(244,182,55,0.9)]'
            : ''
        }`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-36 w-36 sm:h-42 sm:w-42">
            {/* Up Button */}
            <button
              type="button"
              onPointerDown={() => handleDpad('up')}
              onPointerUp={handleRelease}
              onPointerLeave={handleRelease}
              onPointerCancel={handleRelease}
              aria-label="Arriba"
              data-pressed={pressedDir === 'up' ? 'true' : 'false'}
              className={`absolute left-12 sm:left-14 top-0 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-t-2xl border-2 text-slate-200 transition-all duration-75 ease-out origin-bottom cursor-pointer ${
                pressedDir === 'up'
                  ? 'translate-y-[3px] scale-[0.94] bg-[#f4b637] border-yellow-200 shadow-[inset_0_3px_6px_rgba(0,0,0,0.45)] text-slate-950'
                  : 'bg-slate-900/95 border-[#f4b637]/45 shadow-[0_4px_10px_rgba(0,0,0,0.85)] active:translate-y-[3px] active:scale-[0.94] active:bg-[#f4b637] active:text-slate-950'
              }`}
            >
              <ArrowUp className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>

            {/* Down Button */}
            <button
              type="button"
              onPointerDown={() => handleDpad('down')}
              onPointerUp={handleRelease}
              onPointerLeave={handleRelease}
              onPointerCancel={handleRelease}
              aria-label="Abajo"
              data-pressed={pressedDir === 'down' ? 'true' : 'false'}
              className={`absolute bottom-0 left-12 sm:left-14 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-b-2xl border-2 text-slate-200 transition-all duration-75 ease-out origin-top cursor-pointer ${
                pressedDir === 'down'
                  ? 'translate-y-[3px] scale-[0.94] bg-[#f4b637] border-yellow-200 shadow-[inset_0_3px_6px_rgba(0,0,0,0.45)] text-slate-950'
                  : 'bg-slate-900/95 border-[#f4b637]/45 shadow-[0_4px_10px_rgba(0,0,0,0.85)] active:translate-y-[3px] active:scale-[0.94] active:bg-[#f4b637] active:text-slate-950'
              }`}
            >
              <ArrowDown className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>

            {/* Left Button */}
            <button
              type="button"
              onPointerDown={() => handleDpad('left')}
              onPointerUp={handleRelease}
              onPointerLeave={handleRelease}
              onPointerCancel={handleRelease}
              aria-label="Izquierda"
              data-pressed={pressedDir === 'left' ? 'true' : 'false'}
              className={`absolute left-0 top-12 sm:top-14 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-l-2xl border-2 text-slate-200 transition-all duration-75 ease-out origin-right cursor-pointer ${
                pressedDir === 'left'
                  ? 'translate-y-[3px] scale-[0.94] bg-[#f4b637] border-yellow-200 shadow-[inset_0_3px_6px_rgba(0,0,0,0.45)] text-slate-950'
                  : 'bg-slate-900/95 border-[#f4b637]/45 shadow-[0_4px_10px_rgba(0,0,0,0.85)] active:translate-y-[3px] active:scale-[0.94] active:bg-[#f4b637] active:text-slate-950'
              }`}
            >
              <ArrowLeft className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>

            {/* Right Button */}
            <button
              type="button"
              onPointerDown={() => handleDpad('right')}
              onPointerUp={handleRelease}
              onPointerLeave={handleRelease}
              onPointerCancel={handleRelease}
              aria-label="Derecha"
              data-pressed={pressedDir === 'right' ? 'true' : 'false'}
              className={`absolute right-0 top-12 sm:top-14 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-r-2xl border-2 text-slate-200 transition-all duration-75 ease-out origin-left cursor-pointer ${
                pressedDir === 'right'
                  ? 'translate-y-[3px] scale-[0.94] bg-[#f4b637] border-yellow-200 shadow-[inset_0_3px_6px_rgba(0,0,0,0.45)] text-slate-950'
                  : 'bg-slate-900/95 border-[#f4b637]/45 shadow-[0_4px_10px_rgba(0,0,0,0.85)] active:translate-y-[3px] active:scale-[0.94] active:bg-[#f4b637] active:text-slate-950'
              }`}
            >
              <ArrowRight className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>

            {/* Center block */}
            <div className="absolute left-12 sm:left-14 top-12 sm:top-14 h-12 w-12 sm:h-14 sm:w-14 bg-slate-950 border-2 border-[#f4b637]/30 shadow-inner flex items-center justify-center">
              <div className="h-4 w-4 rounded-full bg-[#f4b637]/30" />
            </div>
          </div>
        </div>
      </div>

      {/* --- ENLARGED A ACTION BUTTON ONLY (Right) --- */}
      <div className="pointer-events-auto flex items-end pb-1 pr-1 sm:pr-2">
        <div
          data-testid="button-a-control"
          className={`flex flex-col items-center gap-1.5 rounded-3xl p-1.5 transition-all ${
            highlightControls
              ? 'ring-4 ring-[#f4b637] bg-[#f4b637]/10 shadow-[0_0_28px_rgba(244,182,55,0.9)]'
              : ''
          }`}
        >
          <button
            type="button"
            onPointerDown={handleAPointerDown}
            onPointerUp={handleAPointerUp}
            onPointerLeave={handleAPointerUp}
            onPointerCancel={handleAPointerUp}
            aria-label="Botón A Disparo"
            data-pressed={isAPressed ? 'true' : 'false'}
            className={`flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border-2 sm:border-3 font-pixel text-base sm:text-lg font-bold text-slate-950 transition-all duration-75 ease-out cursor-pointer ${
              isAPressed
                ? 'translate-y-[4px] scale-[0.92] bg-[#d99b1e] border-yellow-100 shadow-[inset_0_4px_10px_rgba(0,0,0,0.45),0_0_12px_rgba(244,182,55,0.45)]'
                : '-translate-y-1 bg-[#f4b637] border-yellow-200 shadow-[0_6px_0_#a6740d,0_10px_25px_rgba(244,182,55,0.45)] ring-2 ring-[#f4b637]/35 active:translate-y-[4px] active:scale-[0.92]'
            }`}
          >
            A
          </button>
          <span className="font-pixel text-[9px] sm:text-[10px] text-[#f4b637] tracking-wider">
            DISPARO
          </span>
        </div>
      </div>
    </div>
  );
});

