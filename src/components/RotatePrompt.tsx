/**
 * Mobile / Tablet Orientation Prompt Component for Desvelada.
 * Displays an intuitive prompt when the device is held vertically in portrait mode,
 * guiding the player to turn their phone/tablet horizontally for optimal two-thumb gameplay.
 */

import React, { useEffect, useState } from 'react';
import { Smartphone, RotateCw } from 'lucide-react';

export const RotatePrompt: React.FC = () => {
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window === 'undefined') return;
      // Detect if width < height (portrait) and is a touch or mobile-sized device
      const isVertical = window.innerHeight > window.innerWidth;
      const isMobileDevice =
        'ontouchstart' in window ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
        window.innerWidth < 1024;

      setIsPortrait(isVertical && isMobileDevice);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!isPortrait || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6 backdrop-blur-md select-none text-slate-100 animate-in fade-in duration-300">
      <div className="relative flex flex-col items-center max-w-xs text-center">
        {/* Glow */}
        <div className="absolute -top-10 h-32 w-32 rounded-full bg-pink-600/30 blur-3xl pointer-events-none" />

        {/* Animated Phone Icon */}
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl">
          <Smartphone className="h-12 w-12 text-pink-400 animate-pulse transition-transform duration-700 transform rotate-0 hover:rotate-90" />
          <RotateCw className="absolute -bottom-2 -right-2 h-7 w-7 text-indigo-400 animate-spin" style={{ animationDuration: '4s' }} />
        </div>

        <h3 className="font-pixel text-sm tracking-wider text-pink-400 leading-snug">
          GIRA TU DISPOSITIVO
        </h3>
        <p className="mt-1 font-retro text-2xl text-slate-300">
          MODO HORIZONTAL REQUERIDO
        </p>

        <p className="mt-3 text-xs leading-relaxed text-slate-400 font-sans-modern">
          Para jugar con la consola en tus manos, registrar la habitación con comodidad y tener la cruceta y botones en ambos pulgares, coloca tu dispositivo en horizontal.
        </p>

        <button
          onClick={() => setDismissed(true)}
          className="mt-6 text-[11px] text-slate-500 hover:text-slate-300 underline font-sans-modern transition"
        >
          Continuar en vertical de todos modos
        </button>
      </div>
    </div>
  );
};
