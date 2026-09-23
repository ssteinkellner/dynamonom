export type SessionTimerName =
  | "action-deadline"
  | "action-display"
  | "countdown"
  | "beat"
  | "break-deadline"
  | "break-display"
  | "resume-countdown";

export interface SessionScheduler {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(handle: number): void;
  setInterval(callback: () => void, delayMs: number): number;
  clearInterval(handle: number): void;
}

export interface AudioPlayer {
  ensureReady(): Promise<void>;
  playTone(frequency: number): void;
}

export type SessionEngineEvent =
  | {
      type: "timer";
      timer: SessionTimerName;
      kind: "timeout" | "interval";
      token: number;
      now: number;
    }
  | { type: "audio-error"; error: Error };

export type SessionEngineListener = (event: SessionEngineEvent) => void;

export interface SessionEngineOptions {
  scheduler?: SessionScheduler;
  audioPlayer?: AudioPlayer;
}

const browserScheduler: SessionScheduler = {
  now: () => performance.now(),
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: (handle) => window.clearTimeout(handle),
  setInterval: (callback, delayMs) => window.setInterval(callback, delayMs),
  clearInterval: (handle) => window.clearInterval(handle),
};

export class WebAudioPlayer implements AudioPlayer {
  private audioContext: AudioContext | null = null;

  async ensureReady(): Promise<void> {
    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      throw new Error("Dieser Browser unterstützt die Web-Audio-API nicht.");
    }

    if (!this.audioContext || this.audioContext.state === "closed") {
      this.audioContext = new AudioContextConstructor();
    }

    if (this.audioContext.state !== "running") {
      await this.audioContext.resume();
    }

    if (this.audioContext.state !== "running") {
      throw new Error("Der Browser hat den Audio-Kontext nicht aktiviert.");
    }
  }

  playTone(frequency: number): void {
    const audioContext = this.audioContext;
    if (!audioContext || audioContext.state !== "running") {
      throw new Error("Der Audio-Kontext läuft nicht.");
    }

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const endTime = now + 0.07;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(endTime);
  }
}

export class SessionEngine {
  private readonly scheduler: SessionScheduler;
  private readonly audioPlayer: AudioPlayer;
  private readonly timeoutHandles = new Map<SessionTimerName, number>();
  private readonly intervalHandles = new Map<SessionTimerName, number>();
  private readonly listeners = new Set<SessionEngineListener>();

  constructor(options: SessionEngineOptions = {}) {
    this.scheduler = options.scheduler ?? browserScheduler;
    this.audioPlayer = options.audioPlayer ?? new WebAudioPlayer();
  }

  now(): number {
    return this.scheduler.now();
  }

  subscribe(listener: SessionEngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  ensureAudioReady(): Promise<void> {
    return this.audioPlayer.ensureReady();
  }

  playTone(frequency: number): boolean {
    try {
      this.audioPlayer.playTone(frequency);
      return true;
    } catch (error) {
      this.emit({
        type: "audio-error",
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  scheduleTimeout(
    timer: SessionTimerName,
    token: number,
    delayMs: number,
  ): void {
    this.cancel(timer);
    const handle = this.scheduler.setTimeout(() => {
      this.timeoutHandles.delete(timer);
      this.emit({
        type: "timer",
        timer,
        kind: "timeout",
        token,
        now: this.scheduler.now(),
      });
    }, Math.max(0, delayMs));
    this.timeoutHandles.set(timer, handle);
  }

  scheduleInterval(
    timer: SessionTimerName,
    token: number,
    intervalMs: number,
  ): void {
    this.cancel(timer);
    const handle = this.scheduler.setInterval(() => {
      this.emit({
        type: "timer",
        timer,
        kind: "interval",
        token,
        now: this.scheduler.now(),
      });
    }, Math.max(1, intervalMs));
    this.intervalHandles.set(timer, handle);
  }

  cancel(timer: SessionTimerName): void {
    const timeoutHandle = this.timeoutHandles.get(timer);
    if (timeoutHandle !== undefined) {
      this.scheduler.clearTimeout(timeoutHandle);
      this.timeoutHandles.delete(timer);
    }

    const intervalHandle = this.intervalHandles.get(timer);
    if (intervalHandle !== undefined) {
      this.scheduler.clearInterval(intervalHandle);
      this.intervalHandles.delete(timer);
    }
  }

  cancelAll(): void {
    for (const timer of this.timeoutHandles.keys()) {
      this.cancel(timer);
    }
    for (const timer of this.intervalHandles.keys()) {
      this.cancel(timer);
    }
  }

  dispose(): void {
    this.cancelAll();
    this.listeners.clear();
  }

  private emit(event: SessionEngineEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}

function getAudioContextConstructor():
  | (new () => AudioContext)
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const audioWindow = window as Window & {
    webkitAudioContext?: new () => AudioContext;
  };
  return window.AudioContext ?? audioWindow.webkitAudioContext;
}
