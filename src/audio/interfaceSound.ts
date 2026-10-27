import { useSyncExternalStore } from "react";

// Short synthesized foley, created only after a user gesture. No audio downloads.
let context: AudioContext | undefined;
let enabled = (() => { try { return localStorage.getItem("room-sound-effects") !== "off"; } catch { return true; } })();
const subscribers = new Set<() => void>();
const subscribe = (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; };
export function useSoundEffects() {
  const active = useSyncExternalStore(subscribe, () => enabled, () => true);
  return [active, (value: boolean) => {
    enabled = value;
    try { localStorage.setItem("room-sound-effects", value ? "on" : "off"); } catch { /* Storage may be unavailable. */ }
    subscribers.forEach(listener => listener());
  }] as const;
}

function audioContext() {
  if (!enabled || document.hidden) return null;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    return context;
  } catch { return null; }
}

function click(ctx: AudioContext, time: number, duration: number, frequency: number, gain: number) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.exp(-7 * i / samples.length);
  const noise = ctx.createBufferSource(); noise.buffer = buffer;
  const filter = ctx.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = frequency; filter.Q.value = .7;
  const volume = ctx.createGain(); volume.gain.value = gain;
  noise.connect(filter).connect(volume).connect(ctx.destination);
  noise.onended = () => { noise.disconnect(); filter.disconnect(); volume.disconnect(); };
  noise.start(time); noise.stop(time + duration);
}

export function playSwitchSound() {
  const ctx = audioContext(); if (!ctx) return;
  click(ctx, ctx.currentTime, .045, 1250, .65);
  click(ctx, ctx.currentTime + .024, .03, 2400, .26);
}

let lastKey = 0;
export function playTypingSound(key: string) {
  const now = performance.now(); if (now - lastKey < 28) return;
  lastKey = now;
  const ctx = audioContext(); if (!ctx) return;
  const enter = key === "Enter";
  click(ctx, ctx.currentTime, enter ? .055 : .024, enter ? 650 : 1400 + Math.random() * 550, enter ? .32 : .18);
}

export function playTerminalOpenSound() {
  const ctx = audioContext(); if (!ctx) return;
  const volume = ctx.createGain(); volume.connect(ctx.destination);
  volume.gain.setValueAtTime(0, ctx.currentTime);
  volume.gain.linearRampToValueAtTime(.075, ctx.currentTime + .012);
  volume.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .17);
  const oscillator = ctx.createOscillator(); oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(440, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + .12);
  oscillator.connect(volume); oscillator.start(); oscillator.stop(ctx.currentTime + .18);
  oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
}
