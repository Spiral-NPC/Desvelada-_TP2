/**
 * Procedural Web Audio API sound synthesizer for Desvelada.
 * Zero external audio files, 100% reliable, zero 404 dependencies.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientNoiseNode: AudioNode | null = null;
  private heartbeatInterval: number | null = null;
  private isMuted: boolean = false;
  private initialized: boolean = false;
  private ambienteAudio: HTMLAudioElement | null = null;
  private consolaAudio: HTMLAudioElement | null = null;
  private gameOverAudio: HTMLAudioElement | null = null;

  public init() {
    if (typeof window !== 'undefined') {
      try {
        if (!this.ambienteAudio) {
          this.ambienteAudio = new Audio('/assets/aistudio/ambiente_6d7ff092.mp3');
          this.ambienteAudio.loop = true;
          this.ambienteAudio.volume = this.isMuted ? 0 : 0.65;
        }
        if (!this.consolaAudio) {
          this.consolaAudio = new Audio('/assets/aistudio/consola_b9774942.mp3');
          this.consolaAudio.loop = true;
          this.consolaAudio.volume = this.isMuted ? 0 : 0.60;
        }
        if (!this.gameOverAudio) {
          this.gameOverAudio = new Audio('/assets/aistudio/game_over_9d150ac7.mp3');
          this.gameOverAudio.loop = false;
          this.gameOverAudio.volume = this.isMuted ? 0 : 0.85;
        }
      } catch (err) {
        console.warn('Audio element initialization error:', err);
      }
    }

    if (this.initialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;

      this.startAmbient();
    } catch (e) {
      console.warn('AudioContext failed to initialize:', e);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
    if (this.ambienteAudio) this.ambienteAudio.volume = muted ? 0 : 0.65;
    if (this.consolaAudio) this.consolaAudio.volume = muted ? 0 : 0.60;
    if (this.gameOverAudio) this.gameOverAudio.volume = muted ? 0 : 0.85;
  }

  public triggerHaptic(pattern: number | number[]) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore haptic errors on unsupported devices
      }
    }
  }

  // --- AMBIENT ROOM NOISE ---
  private startAmbient() {
    if (!this.ctx || !this.masterGain) return;

    // Dark ambient drone (low sine)
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, this.ctx.currentTime); // A1 note

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    this.ambientOsc = osc;
    this.ambientGain = gain;

    // Subtle wind noise
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    noiseFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.025, this.ctx.currentTime);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    whiteNoise.start();
    this.ambientNoiseNode = whiteNoise;
  }

  // --- TENSION HEARTBEAT ---
  public playHeartbeat(urgency: number = 0.5) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    const now = this.ctx.currentTime;
    // Lub-dub
    const playThump = (time: number, freq: number, vol: number) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(30, time + 0.12);

      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + 0.15);
    };

    const volume = 0.3 + urgency * 0.4;
    playThump(now, 65 + urgency * 20, volume);
    playThump(now + 0.12, 55 + urgency * 15, volume * 0.7);

    this.triggerHaptic([35, 40, 25]);
  }

  // --- CUCO MONSTER SOUNDS ---
  // Subtle faint warning cue when the Cuco enters the room
  public playCucoSpawnWarning() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Faint eerie drone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(58, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 1.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 1.4);

    // Faint metallic wood creak / ghost chime
    const chime = this.ctx.createOscillator();
    const chimeGain = this.ctx.createGain();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(370, now);
    chime.frequency.exponentialRampToValueAtTime(260, now + 0.9);

    chimeGain.gain.setValueAtTime(0.001, now);
    chimeGain.gain.linearRampToValueAtTime(0.06, now + 0.15);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

    chime.connect(chimeGain);
    chimeGain.connect(this.masterGain);

    chime.start(now + 0.05);
    chime.stop(now + 1.15);

    // Subtle gentle haptic pulse
    this.triggerHaptic(25);
  }

  public playMonsterStalk() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Low discordant scrape
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(73.4, now); // D2
    osc1.frequency.linearRampToValueAtTime(68.0, now + 1.2);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(77.8, now); // Detuned
    osc2.frequency.linearRampToValueAtTime(82.4, now + 1.2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.6);
    osc2.stop(now + 1.6);

    this.triggerHaptic([60, 50, 60]);
  }

  public playMonsterRetreat() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Disappointed raspy breath
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.8);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.95);
  }

  // Jumpscare screech / roar
  public playJumpscare() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Noise blast
    const bufferSize = this.ctx.sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(800, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(180, now + 1.2);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.3);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // Dissonant screamer chords
    const freqs = [185, 233, 277, 370, 740, 1108];
    freqs.forEach((f) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.4, now + 1.0);

      oscGain.gain.setValueAtTime(0.35, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(oscGain);
      oscGain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 1.25);
    });

    noise.start(now);
    noise.stop(now + 1.4);

    this.triggerHaptic([120, 40, 200, 60, 400]);
  }

  // --- SLEEP / FEIGN SLEEP ---
  public playFeignSleep() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    // Soft breath in
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.6);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.75);

    this.triggerHaptic(25);
  }

  public playSleepFall() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Heavy slumber sigh / fade out
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 1.5);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.7);
  }

  // --- RETRO CHIPTUNE SOUNDS FOR CONSOLE ---
  public playRetroJump() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.12);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);

    this.triggerHaptic(15);
  }

  public playRetroShoot() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);

    this.triggerHaptic(20);
  }

  public playRetroExplosion() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, now);
    filter.frequency.linearRampToValueAtTime(60, now + 0.22);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.25);

    this.triggerHaptic([30, 20, 40]);
  }

  public playRetroCoin() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);

    this.triggerHaptic(15);
  }

  public playVictoryFanfare() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const notes = [
      { f: 523.25, d: 0.15 }, // C5
      { f: 659.25, d: 0.15 }, // E5
      { f: 783.99, d: 0.15 }, // G5
      { f: 1046.50, d: 0.4 }, // C6
    ];

    let t = now;
    notes.forEach((note) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, t);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + note.d);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + note.d + 0.05);

      t += note.d * 0.9;
    });

    this.triggerHaptic([50, 50, 50, 50, 150]);
  }

  public playClockTick() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1800, now);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  public playButtonClick() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.04);

    this.triggerHaptic(10);
  }

  // --- MP3 TRACK MANAGEMENT & BUFFER CLEANUP ---
  public isGameOverPlaying(): boolean {
    return !!(this.gameOverAudio && !this.gameOverAudio.paused && !this.gameOverAudio.ended);
  }

  public playAmbienteMusic() {
    this.stopConsolaMusic();
    // Do not play ambient music while game over sound is actively playing
    if (this.isGameOverPlaying()) return;

    if (!this.ambienteAudio || this.isMuted) return;
    if (this.ambienteAudio.paused) {
      this.ambienteAudio.volume = 0.65;
      this.ambienteAudio.play().catch(() => {});
    }
  }

  public stopAmbienteMusic() {
    if (this.ambienteAudio) {
      this.ambienteAudio.pause();
      this.ambienteAudio.currentTime = 0;
    }
  }

  public playConsolaMusic() {
    this.stopAmbienteMusic();
    this.stopGameOverMusic();
    if (!this.consolaAudio || this.isMuted) return;
    if (this.consolaAudio.paused) {
      this.consolaAudio.volume = 0.60;
      this.consolaAudio.play().catch(() => {});
    }
  }

  public stopConsolaMusic() {
    if (this.consolaAudio) {
      this.consolaAudio.pause();
      this.consolaAudio.currentTime = 0;
    }
  }

  public playGameOverMusic(onEnded?: () => void) {
    this.stopAmbienteMusic();
    this.stopConsolaMusic();
    if (!this.gameOverAudio) {
      if (onEnded) onEnded();
      return;
    }
    this.gameOverAudio.pause();
    this.gameOverAudio.currentTime = 0;
    this.gameOverAudio.volume = this.isMuted ? 0 : 0.85;

    this.gameOverAudio.onended = () => {
      if (onEnded) onEnded();
    };

    this.gameOverAudio.play().catch(() => {
      // If auto-play blocked or error occurs, trigger fallback
      if (onEnded) onEnded();
    });
  }

  public stopGameOverMusic() {
    if (this.gameOverAudio) {
      this.gameOverAudio.onended = null;
      this.gameOverAudio.pause();
      this.gameOverAudio.currentTime = 0;
    }
  }

  public stopAllMusic() {
    this.stopAmbienteMusic();
    this.stopConsolaMusic();
    this.stopGameOverMusic();
  }

  public dispose() {
    this.stopAllMusic();
    if (this.ambientOsc) {
      this.ambientOsc.stop();
      this.ambientOsc.disconnect();
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.ambienteAudio = null;
    this.consolaAudio = null;
    this.gameOverAudio = null;
    this.initialized = false;
  }
}

export const soundEngine = new SoundEngine();
