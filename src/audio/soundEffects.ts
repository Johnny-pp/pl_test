import type { GameSettings } from "../settings/settings.ts";

export type SfxName =
  | "click"
  | "hover"
  | "hit"
  | "capture"
  | "levelup"
  | "victory"
  | "defeat"
  | "gather"
  | "open"
  | "heal"
  | "error";

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];

/**
 * 原创音效引擎：用 Web Audio API 合成短促音效与简单环境 BGM，
 * 不依赖任何外部音频素材，权属清晰。
 */
class SoundEffects {
  private context?: AudioContext;
  private sfxGain?: GainNode;
  private bgmGain?: GainNode;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private unlocked = false;
  private volumes: { master: number; bgm: number; sfx: number } = {
    master: 0.8,
    bgm: 0.6,
    sfx: 0.8,
  };

  /** 在用户首次交互后解锁音频上下文并开始环境音乐。 */
  unlock(): void {
    this.ensureContext();
    if (this.unlocked || !this.context) return;
    this.unlocked = true;
    this.startBgm();
  }
  ensureContext(): void {
    if (!this.context) {
      try {
        const AudioContextCtor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;
        this.context = new AudioContextCtor();
        this.sfxGain = this.context.createGain();
        this.sfxGain.gain.value = this.volumes.master * this.volumes.sfx;
        this.sfxGain.connect(this.context.destination);
        this.bgmGain = this.context.createGain();
        this.bgmGain.gain.value = this.volumes.master * this.volumes.bgm * 0.5;
        this.bgmGain.connect(this.context.destination);
      } catch {
        return;
      }
    }
    if (this.context.state === "suspended") void this.context.resume();
  }

  setVolumes(settings: GameSettings): void {
    this.volumes = {
      master: settings.masterVolume,
      bgm: settings.bgmVolume,
      sfx: settings.sfxVolume,
    };
    if (this.sfxGain) this.sfxGain.gain.value = this.volumes.master * this.volumes.sfx;
    if (this.bgmGain) this.bgmGain.gain.value = this.volumes.master * this.volumes.bgm * 0.5;
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
    slideTo?: number
  ): void {
    if (!this.context || !this.sfxGain) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.sfxGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  private noise(duration: number, volume: number, delay = 0): void {
    if (!this.context || !this.sfxGain) return;
    const start = this.context.currentTime + delay;
    const bufferSize = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < bufferSize; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / bufferSize);
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(gain);
    gain.connect(this.sfxGain);
    source.start(start);
  }

  play(name: SfxName): void {
    this.unlock();
    if (!this.context || this.volumes.master <= 0) return;
    switch (name) {
      case "click":
        this.tone(620, 0.07, "square", 0.18);
        this.tone(880, 0.06, "square", 0.1, 0.045);
        break;
      case "hover":
        this.tone(480, 0.04, "sine", 0.06);
        break;
      case "hit":
        this.noise(0.12, 0.25);
        this.tone(180, 0.12, "triangle", 0.28, 0, 90);
        break;
      case "capture":
        this.tone(523.25, 0.1, "triangle", 0.22);
        this.tone(659.25, 0.1, "triangle", 0.22, 0.09);
        this.tone(783.99, 0.16, "triangle", 0.26, 0.18);
        break;
      case "levelup":
        this.tone(392, 0.09, "square", 0.16);
        this.tone(523.25, 0.09, "square", 0.16, 0.08);
        this.tone(659.25, 0.09, "square", 0.16, 0.16);
        this.tone(783.99, 0.2, "square", 0.2, 0.24);
        break;
      case "victory":
        this.tone(392, 0.14, "triangle", 0.2);
        this.tone(523.25, 0.14, "triangle", 0.2, 0.13);
        this.tone(659.25, 0.14, "triangle", 0.2, 0.26);
        this.tone(783.99, 0.26, "triangle", 0.24, 0.39);
        break;
      case "defeat":
        this.tone(330, 0.18, "sawtooth", 0.16, 0, 160);
        this.tone(200, 0.26, "sawtooth", 0.18, 0.16, 110);
        break;
      case "gather":
        this.tone(880, 0.08, "sine", 0.16);
        this.tone(1174.66, 0.12, "sine", 0.14, 0.07);
        break;
      case "open":
        this.tone(523.25, 0.09, "sine", 0.16);
        this.tone(659.25, 0.14, "sine", 0.16, 0.08);
        break;
      case "heal":
        this.tone(440, 0.12, "sine", 0.16, 0, 880);
        this.tone(660, 0.16, "sine", 0.14, 0.1, 990);
        break;
      case "error":
        this.tone(180, 0.12, "square", 0.16, 0, 140);
        this.tone(140, 0.16, "square", 0.14, 0.1, 110);
        break;
    }
  }

  /** 启动简易环境 BGM（五声音阶柔和循环，音量低且无版权问题）。 */
  startBgm(): void {
    this.ensureContext();
    if (this.bgmTimer !== null || !this.context || this.volumes.bgm <= 0) return;
    this.bgmStep = 0;
    const tick = () => {
      if (!this.context || !this.bgmGain) return;
      const note = PENTATONIC[this.bgmStep % PENTATONIC.length];
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const start = this.context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.value = note / 2;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.6);
      oscillator.connect(gain);
      gain.connect(this.bgmGain);
      oscillator.start(start);
      oscillator.stop(start + 2.7);
      if (this.bgmStep % 4 === 3) {
        const harmony = this.context.createOscillator();
        const harmonyGain = this.context.createGain();
        harmony.type = "triangle";
        harmony.frequency.value = note / 4;
        harmonyGain.gain.setValueAtTime(0.0001, start);
        harmonyGain.gain.exponentialRampToValueAtTime(0.3, start + 0.6);
        harmonyGain.gain.exponentialRampToValueAtTime(0.0001, start + 2.8);
        harmony.connect(harmonyGain);
        harmonyGain.connect(this.bgmGain);
        harmony.start(start);
        harmony.stop(start + 2.9);
      }
      this.bgmStep += 1;
    };
    tick();
    this.bgmTimer = window.setInterval(tick, 3000);
  }

  stopBgm(): void {
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

/** 全局音效实例，供场景在关键操作时调用。 */
export const soundEffects = new SoundEffects();
