/**
 * Mobile / Tablet Orientation Prompt Component for Desvelada.
 * Strictly enforces landscape orientation on mobile and tablets.
 */

import React, { useEffect, useState } from 'react';
import { Smartphone, RotateCw } from 'lucide-react';

export const RotatePrompt: React.FC = () => {
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

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

  if (!isPortrait) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6 select-none text-slate-100 animate-in fade-in duration-300">
      <div className="relative flex flex-col items-center max-w-xs text-center">
        {/* Glow */}
        <div className="absolute -top-10 h-32 w-32 rounded-full bg-[#f4b637]/25 blur-3xl pointer-events-none" />

        {/* Animated Phone Icon */}
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-900 border border-[#f4b637]/50 shadow-2xl">
          <Smartphone className="h-12 w-12 text-[#f4b637] animate-pulse" />
          <RotateCw className="absolute -bottom-2 -right-2 h-7 w-7 text-[#f4b637] animate-spin" style={{ animationDuration: '4s' }} />
        </div>

        <h3 className="font-pixel text-sm tracking-wider text-[#f4b637] leading-snug">
          GIRA TU DISPOSITIVO
        </h3>
        <p className="mt-1 font-retro text-2xl text-slate-200">
          MODO HORIZONTAL OBLIGATORIO
        </p>

        <p className="mt-3 text-xs leading-relaxed text-slate-400 font-sans-modern">
          Para jugar con la consola en tus manos, explorar la gran habitación y tener los controles ergonómicos en tus pulgares, coloca tu teléfono o tablet en horizontal.
        </p>

        <div className="mt-5 rounded-full bg-[#f4b637]/15 px-4 py-1.5 border border-[#f4b637]/50 text-[10px] font-pixel text-[#f4b637]">
          GIRA LA PANTALLA PARA CONTINUAR
        </div>
      </div>
    </div>
  );
};
