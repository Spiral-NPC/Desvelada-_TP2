/**
 * Quick Interactive Tutorial Overlay shown ONLY on the player's very first game after pressing JUGAR.
 * Never triggers on retries or subsequent sessions once completed/dismissed.
 */

import React, { useState } from 'react';
import { Gamepad2, Flashlight, EyeOff, ArrowRight, Check, X } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';

interface TutorialOverlayProps {
  visible: boolean;
  onComplete: () => void;
}

const TUTORIAL_STEPS = [
  {
    icon: Gamepad2,
    badge: 'PASO 1 DE 3 · LA CONSOLA',
    title: 'Juega y Llega al Nivel 15',
    description:
      'Usa las flechas y el botón A (Disparo) para destruir invasores. Jugar te mantiene despierto. ¡Llega y derrota al Jefe Final del Nivel 15 para ganar!',
  },
  {
    icon: Flashlight,
    badge: 'PASO 2 DE 3 · LA HABITACIÓN',
    title: 'Vigila la Oscuridad',
    description:
      'Desliza el dedo hacia arriba para levantar la vista y mover la linterna por el cuarto. Ten cuidado: si pasas demasiado tiempo sin jugar en la consola, te quedarás dormido.',
  },
  {
    icon: EyeOff,
    badge: 'PASO 3 DE 3 · EL CUCO',
    title: 'Alumbra al Cuco y Finge Dormir',
    description:
      'Cuando escuches un sonido extraño o veas un movimiento, apunta la linterna a cualquier parte del Cuco hasta que chille y la luz parpadee. ¡Luego mantén "HACERSE EL DORMIDO" hasta que se retire!',
  },
];

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ visible, onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);

  if (!visible) return null;

  const current = TUTORIAL_STEPS[stepIndex];
  const Icon = current.icon;
  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    soundEngine.playButtonClick();
    if (isLast) {
      setStepIndex(0);
      onComplete();
    } else {
      setStepIndex((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    soundEngine.playButtonClick();
    setStepIndex(0);
    onComplete();
  };

  return (
    <div
      data-testid="tutorial-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 select-none overflow-y-auto"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-slate-950 p-5 sm:p-6 text-slate-100 shadow-2xl border-2 border-[#f4b637]/70">
        {/* Yellow primary accent glow */}
        <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-20 w-44 rounded-full bg-[#f4b637]/25 blur-2xl" />

        {/* Header row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4b637]/15 px-3 py-1 font-pixel text-[9px] text-[#f4b637] border border-[#f4b637]/50">
            {current.badge}
          </span>
          <button
            type="button"
            onClick={handleSkip}
            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-sans-modern font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition cursor-pointer"
          >
            <span>Saltar</span>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Visual Icon & Copy */}
        <div className="flex items-start gap-3.5 rounded-2xl bg-slate-900/80 p-4 border border-slate-800">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f4b637]/15 border border-[#f4b637]/50 text-[#f4b637]">
            <Icon className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h3 className="font-pixel text-xs sm:text-sm text-[#f4b637] leading-snug">
              {current.title}
            </h3>
            <p className="mt-1.5 text-xs sm:text-[13px] leading-relaxed text-slate-200 font-sans-modern">
              {current.description}
            </p>
          </div>
        </div>

        {/* Step dots + CTA */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-label="Progreso del tutorial">
            {TUTORIAL_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`h-2 rounded-full transition-all ${
                  idx === stepIndex
                    ? 'w-6 bg-[#f4b637]'
                    : idx < stepIndex
                    ? 'w-2 bg-[#f4b637]/60'
                    : 'w-2 bg-slate-700'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            data-testid="tutorial-next"
            onClick={handleNext}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f4b637] hover:bg-[#f7c55c] px-5 py-2.5 font-pixel text-[11px] font-bold text-slate-950 shadow-[0_4px_18px_rgba(244,182,55,0.4)] active:scale-95 transition cursor-pointer"
          >
            {isLast ? (
              <>
                <Check className="h-4 w-4" />
                <span>¡ENTENDIDO!</span>
              </>
            ) : (
              <>
                <span>SIGUIENTE</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
