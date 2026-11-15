/**
 * Interactive Guided Tutorial Overlay shown on the player's first game.
 * Draws dynamic animated #f4b637 SVG pointer arrows straight to the live HUD
 * and console buttons ("HACERSE EL DORMIDO", Medidor de Sueño, D-Pad, Botón A,
 * Puntaje y Niveles) as each mechanic is explained.
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Gamepad2, Moon, Flashlight, EyeOff, ArrowRight, Check, X } from 'lucide-react';
import { TutorialHighlightTarget } from './HUD';

interface TutorialTargetSpec {
  selector: string;
  label: string;
}

interface TutorialStep {
  icon: typeof Gamepad2;
  badge: string;
  title: string;
  description: string;
  highlight: TutorialHighlightTarget;
  targets: TutorialTargetSpec[];
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    icon: Gamepad2,
    badge: 'PASO 1 DE 4 · CONTROLES',
    title: 'Muévete y Dispara en la Consola',
    description:
      'Usa la Cruceta (izquierda) para mover tu nave y el Botón A (derecha) para disparar. ¡Llega y derrota al Jefe Final del Nivel 15 para ganar!',
    highlight: 'controls',
    targets: [
      { selector: '[data-testid="dpad-controls"]', label: 'MOVER NAVE' },
      { selector: '[data-testid="button-a-control"]', label: 'BOTÓN A · DISPARAR' },
    ],
  },
  {
    icon: Moon,
    badge: 'PASO 2 DE 4 · NIVEL DE SUEÑO',
    title: 'Vigila el Medidor de Sueño',
    description:
      'Jugar te mantiene despierto. Si pasas demasiado tiempo mirando la habitación o fingiendo dormir, esta barra se llenará y perderás.',
    highlight: 'sleep-meter',
    targets: [
      { selector: '[data-testid="boredom-meter"]', label: 'MEDIDOR DE SUEÑO' },
    ],
  },
  {
    icon: Flashlight,
    badge: 'PASO 3 DE 4 · PROGRESO Y LINTERNA',
    title: 'Niveles Faltantes y la Oscuridad',
    description:
      'Arriba ves tu puntaje y cuántos niveles faltan. Desliza el dedo hacia arriba para mirar el cuarto y alumbrar cualquier parte del Cuco con la linterna.',
    highlight: 'hud-stats',
    targets: [
      { selector: '[data-testid="hud-stats"]', label: 'PUNTAJE Y NIVELES' },
    ],
  },
  {
    icon: EyeOff,
    badge: 'PASO 4 DE 4 · BOTÓN DORMIR',
    title: 'Botón: Hacerse el Dormido',
    description:
      'Cuando alumbres al Cuco y la linterna parpadee, mantén presionado este botón para cerrar los ojos hasta que el monstruo se retire.',
    highlight: 'sleep-button',
    targets: [
      { selector: '[data-testid="sleep-button"]', label: '¡MANTÉN PRESIONADO AQUÍ!' },
    ],
  },
];

interface ComputedArrow {
  id: string;
  label: string;
  startX: number;
  startY: number;
  ctrlX: number;
  ctrlY: number;
  endX: number;
  endY: number;
  labelX: number;
  labelY: number;
}

interface TutorialOverlayProps {
  visible: boolean;
  onComplete: () => void;
  onHighlightChange?: (highlight: TutorialHighlightTarget) => void;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  visible,
  onComplete,
  onHighlightChange,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [arrows, setArrows] = useState<ComputedArrow[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  const current = TUTORIAL_STEPS[stepIndex];

  useEffect(() => {
    if (visible) {
      onHighlightChange?.(current.highlight);
    } else {
      onHighlightChange?.(null);
    }
  }, [visible, current.highlight, onHighlightChange]);

  const computeArrows = useCallback(() => {
    if (!visible || !cardRef.current) {
      setArrows([]);
      return;
    }

    const cardRect = cardRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nextArrows: ComputedArrow[] = [];

    current.targets.forEach((spec, idx) => {
      const targetEl = document.querySelector(spec.selector) as HTMLElement | null;
      if (!targetEl) return;

      const tRect = targetEl.getBoundingClientRect();
      if (tRect.width === 0 || tRect.height === 0) return;

      const tCenterX = tRect.left + tRect.width / 2;
      const tCenterY = tRect.top + tRect.height / 2;

      let startX = cardRect.left + cardRect.width / 2;
      let startY = cardRect.top;
      let endX = tCenterX;
      let endY = tRect.bottom + 8;

      const gapAbove = cardRect.top - tRect.bottom;
      const isRightSideRoute =
        current.highlight === 'sleep-button' ||
        (tCenterY < cardRect.top && gapAbove < 68 && Math.abs(tCenterX - vw / 2) < 160);

      const isNarrowLeft = tCenterX < cardRect.left && cardRect.left - tRect.right < 130;
      const isNarrowRight = tCenterX > cardRect.right && tRect.left - cardRect.right < 130;

      if (isRightSideRoute) {
        // Point cleanly to the right side of the centered top target so we never cross over adjacent HUD bars
        endX = tRect.right + 10;
        endY = tCenterY;
        startX = cardRect.right - 28;
        startY = cardRect.top + 6;
      } else if (tCenterY < cardRect.top) {
        // Target is ABOVE the tutorial card with plenty of clearance (e.g., hud-stats or desktop sleep-meter)
        endX = tCenterX;
        endY = tRect.bottom + 10;
        startX = clamp(tCenterX, cardRect.left + 36, cardRect.right - 36);
        startY = cardRect.top - 4;
      } else if (isNarrowLeft) {
        // Mobile landscape D-Pad: curve through the open space ABOVE the D-Pad
        endX = tCenterX;
        endY = tRect.top - 10;
        startX = cardRect.left - 4;
        startY = cardRect.top + 34;
      } else if (isNarrowRight) {
        // Mobile landscape Button A: curve through the open space ABOVE Button A
        endX = tCenterX;
        endY = tRect.top - 10;
        startX = cardRect.right + 4;
        startY = cardRect.top + 34;
      } else if (tCenterX < cardRect.left) {
        // Desktop D-Pad: target is to the BOTTOM-LEFT with wide clearance
        endX = tRect.right + 10;
        endY = tRect.top + tRect.height * 0.45;
        startX = cardRect.left - 4;
        startY = clamp(endY - 24, cardRect.top + 32, cardRect.bottom - 20);
      } else if (tCenterX > cardRect.right) {
        // Desktop Button A: target is to the BOTTOM-RIGHT with wide clearance
        endX = tRect.left - 10;
        endY = tRect.top + tRect.height * 0.45;
        startX = cardRect.right + 4;
        startY = clamp(endY - 24, cardRect.top + 32, cardRect.bottom - 20);
      } else {
        // Target is directly BELOW the tutorial card
        endX = tCenterX;
        endY = tRect.top - 10;
        startX = clamp(tCenterX, cardRect.left + 36, cardRect.right - 36);
        startY = cardRect.bottom + 4;
      }

      // Build gentle curve toward open viewport space for clean visual arc
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      const dx = endX - startX;
      const dy = endY - startY;
      const len = Math.hypot(dx, dy) || 1;
      let ctrlX: number;
      let ctrlY: number;

      if (isRightSideRoute) {
        ctrlX = Math.min(vw - 24, Math.max(startX, endX) + 56);
        ctrlY = midY;
      } else if (isNarrowLeft || isNarrowRight) {
        ctrlX = endX;
        ctrlY = Math.min(startY, endY) - 24;
      } else {
        const curveOffset = Math.min(24, len * 0.14) * (tCenterX < vw / 2 ? -1 : 1);
        ctrlX = midX + (-dy / len) * curveOffset;
        ctrlY = midY + (dx / len) * curveOffset;
      }

      // Quadratic curve midpoint t=0.5
      const qMidX = 0.25 * startX + 0.5 * ctrlX + 0.25 * endX;
      const qMidY = 0.25 * startY + 0.5 * ctrlY + 0.25 * endY;

      let computedLabelX = qMidX;
      let computedLabelY = qMidY;
      if (isRightSideRoute) {
        computedLabelX = Math.max(qMidX, endX + 102);
      } else if (isNarrowLeft || isNarrowRight) {
        computedLabelX = endX;
        computedLabelY = Math.min(startY, endY) - 22;
      }

      nextArrows.push({
        id: `${current.highlight}-${idx}`,
        label: spec.label,
        startX,
        startY,
        ctrlX,
        ctrlY,
        endX,
        endY,
        labelX: clamp(computedLabelX, 82, vw - 108),
        labelY: clamp(computedLabelY, 24, vh - 24),
      });
    });

    setArrows(nextArrows);
  }, [visible, current]);

  useLayoutEffect(() => {
    computeArrows();
    const raf = requestAnimationFrame(computeArrows);
    const timer = window.setTimeout(computeArrows, 80);
    window.addEventListener('resize', computeArrows);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener('resize', computeArrows);
    };
  }, [computeArrows]);

  if (!visible) return null;

  const Icon = current.icon;
  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      setStepIndex(0);
      onHighlightChange?.(null);
      onComplete();
    } else {
      setStepIndex((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    setStepIndex(0);
    onHighlightChange?.(null);
    onComplete();
  };

  return (
    <>
      {/* Dimmed backdrop placed BELOW HUD (z-50) & highlighted controls so live targets stay bright */}
      <div
        data-testid="tutorial-overlay"
        className="fixed inset-0 z-[45] bg-black/75 select-none pointer-events-auto"
      />

      {/* Dynamic SVG Arrows & Callout Badges pointing at real buttons */}
      <svg
        data-testid="tutorial-arrows-svg"
        className="pointer-events-none fixed inset-0 z-[60] h-full w-full overflow-visible"
      >
        <defs>
          <marker
            id="tutorial-arrowhead"
            markerWidth="12"
            markerHeight="12"
            refX="9"
            refY="6"
            orient="auto"
          >
            <path d="M1,1 L11,6 L1,11 L3.5,6 Z" fill="#f4b637" />
          </marker>
        </defs>
        {arrows.map((arrow) => (
          <g key={arrow.id}>
            {/* Dark outer halo for contrast over any dark or bright backdrop */}
            <path
              d={`M ${arrow.startX} ${arrow.startY} Q ${arrow.ctrlX} ${arrow.ctrlY} ${arrow.endX} ${arrow.endY}`}
              fill="none"
              stroke="rgba(2, 6, 23, 0.9)"
              strokeWidth="7"
              strokeLinecap="round"
            />
            {/* Primary #f4b637 dashed animated arrow */}
            <path
              d={`M ${arrow.startX} ${arrow.startY} Q ${arrow.ctrlX} ${arrow.ctrlY} ${arrow.endX} ${arrow.endY}`}
              fill="none"
              stroke="#f4b637"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="8 6"
              markerEnd="url(#tutorial-arrowhead)"
              className="animate-pulse"
            />
          </g>
        ))}
      </svg>

      {/* Crisp pointer arrow labels */}
      <div className="pointer-events-none fixed inset-0 z-[61]">
        {arrows.map((arrow) => (
          <div
            key={`${arrow.id}-label`}
            data-testid="tutorial-arrow-label"
            style={{
              left: `${arrow.labelX}px`,
              top: `${arrow.labelY}px`,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute whitespace-nowrap rounded-lg bg-[#f4b637] px-2 py-0.5 font-pixel text-[8px] sm:text-[9px] font-bold text-slate-950 shadow-[0_2px_12px_rgba(244,182,55,0.85)] border border-yellow-100"
          >
            {arrow.label}
          </div>
        ))}
      </div>

      {/* Tutorial Card positioned clear of Top HUD and Bottom Corner Gamepad */}
      <div className="pointer-events-none fixed inset-0 z-[62] flex items-center [@media(max-height:500px)]:items-end justify-center px-4 pt-36 sm:pt-32 [@media(max-height:500px)]:pt-28 pb-4 [@media(max-height:500px)]:pb-2.5 select-none">
        <div
          ref={cardRef}
          className="pointer-events-auto relative w-full max-w-sm sm:max-w-md [@media(max-height:500px)]:max-w-[370px] rounded-3xl bg-slate-950/95 p-4 sm:p-5 [@media(max-height:500px)]:p-3 text-slate-100 shadow-2xl border-2 border-[#f4b637]"
        >
          {/* Yellow primary accent glow */}
          <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 h-16 w-40 rounded-full bg-[#f4b637]/25 blur-2xl" />

          {/* Header row */}
          <div className="flex items-center justify-between gap-2 mb-2.5 [@media(max-height:500px)]:mb-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4b637]/15 px-2.5 py-1 font-pixel text-[8.5px] sm:text-[9px] text-[#f4b637] border border-[#f4b637]/50">
              {current.badge}
            </span>
            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-sans-modern font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition cursor-pointer"
            >
              <span>Saltar</span>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Visual Icon & Copy */}
          <div className="flex items-start gap-3 rounded-2xl bg-slate-900/80 p-3.5 [@media(max-height:500px)]:p-2.5 border border-slate-800">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 [@media(max-height:500px)]:h-9 [@media(max-height:500px)]:w-9 shrink-0 items-center justify-center rounded-2xl bg-[#f4b637]/15 border border-[#f4b637]/50 text-[#f4b637]">
              <Icon className="h-5 w-5 sm:h-6 sm:w-6 [@media(max-height:500px)]:h-4 [@media(max-height:500px)]:w-4" />
            </div>
            <div className="text-left">
              <h3 className="font-pixel text-[11px] sm:text-xs [@media(max-height:500px)]:text-[10px] text-[#f4b637] leading-snug">
                {current.title}
              </h3>
              <p className="mt-1.5 [@media(max-height:500px)]:mt-1 text-[11.5px] sm:text-xs [@media(max-height:500px)]:text-[11px] leading-relaxed [@media(max-height:500px)]:leading-snug text-slate-200 font-sans-modern">
                {current.description}
              </p>
            </div>
          </div>

          {/* Step dots + CTA */}
          <div className="mt-3.5 [@media(max-height:500px)]:mt-2 flex items-center justify-between gap-3">
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
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f4b637] hover:bg-[#f7c55c] px-4 py-2 font-pixel text-[10px] sm:text-[11px] font-bold text-slate-950 shadow-[0_4px_18px_rgba(244,182,55,0.4)] active:scale-95 transition cursor-pointer"
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
    </>
  );
};
