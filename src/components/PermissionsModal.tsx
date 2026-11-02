/**
 * Introductory Welcome & Sensor Permissions Modal for Desvelada.
 * Complies with SDD sensor onboarding flow and iOS 13+ permission requirements.
 */

import React, { useState } from 'react';
import {
  Compass,
  Camera,
  Volume2,
  Gamepad2,
  Moon,
  Eye,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { SensorStatus } from '../types';

interface PermissionsModalProps {
  onStartGame: (options: { enableGyro: boolean; enableCamera: boolean }) => void;
  sensorStatus: SensorStatus;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  onStartGame,
  sensorStatus,
}) => {
  const [requestGyro, setRequestGyro] = useState(true);
  const [requestCamera, setRequestCamera] = useState(false);
  const [step, setStep] = useState<'welcome' | 'instructions'>('welcome');

  const handleStart = async () => {
    onStartGame({
      enableGyro: requestGyro,
      enableCamera: requestCamera,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md rounded-3xl bg-slate-950 p-6 text-slate-100 shadow-2xl border border-slate-800">
        {/* Glow accent */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 h-24 w-48 rounded-full bg-pink-600/20 blur-3xl" />

        {step === 'welcome' ? (
          <div className="space-y-5 text-center">
            {/* Title & Badge */}
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-pink-950/70 px-3 py-1 text-xs font-semibold text-pink-400 border border-pink-800/60 mb-2">
                <Moon className="h-3.5 w-3.5" />
                <span>EXPERIENCIA WEB INMERSIVA</span>
              </div>
              <h1 className="font-pixel text-2xl tracking-wider text-white">
                DESVELADA
              </h1>
              <p className="mt-1 text-xs font-retro text-2xl text-slate-400">
                SOBREVIVE HASTA LAS 6:00 AM
              </p>
            </div>

            {/* Concept Illustration Preview */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left">
              <p className="text-xs leading-relaxed text-slate-300 font-sans-modern">
                Estás solo en tu cama en plena madrugada jugando con tu consola portátil.
                Debes jugar para evitar que la <strong className="text-cyan-400">Barra de Aburrimiento / Sueño</strong> se
                llene. Pero en las sombras de la habitación, el <strong className="text-red-400">Cuco</strong> te acecha...
              </p>
            </div>

            {/* Sensor Permissions Preferences */}
            <div className="space-y-2.5 text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans-modern">
                Sensores del Dispositivo (Opcional):
              </span>

              {/* Gyroscope toggle */}
              <label className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 cursor-pointer hover:bg-slate-900/70 transition">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-950/60 p-2 text-emerald-400 border border-emerald-800/40">
                    <Compass className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white font-sans-modern">
                      Giroscopio / Movimiento 360°
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Gira tu teléfono físicamente para mirar alrededor
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={requestGyro}
                  onChange={(e) => setRequestGyro(e.target.checked)}
                  className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                />
              </label>

              {/* Camera AR toggle */}
              <label className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 cursor-pointer hover:bg-slate-900/70 transition">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-indigo-950/60 p-2 text-indigo-400 border border-indigo-800/40">
                    <Camera className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white font-sans-modern">
                      Modo Realidad Aumentada (Cámara)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Usa tu cámara real como fondo de la habitación
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={requestCamera}
                  onChange={(e) => setRequestCamera(e.target.checked)}
                  className="h-4 w-4 rounded accent-indigo-500 cursor-pointer"
                />
              </label>
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep('instructions')}
                className="flex-1 rounded-2xl bg-slate-800 py-3 text-xs font-bold text-slate-200 hover:bg-slate-700 transition font-sans-modern"
              >
                ¿Cómo Jugar?
              </button>
              <button
                onClick={handleStart}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-indigo-600 py-3 font-pixel text-xs font-bold text-white shadow-xl hover:opacity-90 active:scale-95 transition"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>JUGAR</span>
              </button>
            </div>
          </div>
        ) : (
          /* Instructions Screen */
          <div className="space-y-4">
            <h2 className="font-pixel text-sm text-pink-400 tracking-wider">
              REGLAS DE SUPERVIVENCIA
            </h2>

            <div className="space-y-3 text-xs font-sans-modern text-slate-300">
              <div className="flex items-start gap-2.5 rounded-xl bg-slate-900/60 p-3 border border-slate-800">
                <Gamepad2 className="h-5 w-5 shrink-0 text-cyan-400 mt-0.5" />
                <div>
                  <strong className="text-white">1. Invasores del Espacio por Niveles:</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Al mirar hacia abajo juegas a Space Invaders. Elimina a las tropas alienígenas para superar cada nivel. Al levantar la vista, el juego se <strong className="text-amber-400">pausa automáticamente</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl bg-slate-900/60 p-3 border border-slate-800">
                <Eye className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <strong className="text-white">2. Habitación a oscuras y linterna:</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Todo está en penumbra. Tu cámara proyecta una tenue linterna hacia donde mires para registrar el armario, la puerta, la ventana o el escritorio.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl bg-slate-900/60 p-3 border border-slate-800">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                <div>
                  <strong className="text-white">3. ¡El Cuco no avisa! Hazte el dormido:</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No habrá alertas en pantalla ni sonidos de advertencia. Si alumbras al Cuco acechando, mantén presionado <span className="text-indigo-300 font-bold">FINGIR DORMIR</span> con la frazada antes de que se lance sobre ti.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleStart}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 to-indigo-600 py-3 font-pixel text-xs font-bold text-white shadow-xl hover:opacity-90 active:scale-95 transition"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>INICIAR DESVELADA</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
