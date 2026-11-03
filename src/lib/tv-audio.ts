"use client";

/** Som da TV: gongo de 3 notas gerado no navegador (sem arquivo) + voz pt-BR.
 * Navegadores só liberam som depois de um toque na página — exceto Chromium aberto com
 * --autoplay-policy=no-user-gesture-required (mini PC/Raspberry, ver docs/tv-sala-de-espera.md). */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

/** true se o som já pode tocar sem toque na tela. */
export function audioUnlocked(): boolean {
  const a = audio();
  return !!a && a.state === "running";
}

/** Chamar no toque "Ativar som". */
export async function unlockAudio(): Promise<boolean> {
  const a = audio();
  if (!a) return false;
  try {
    await a.resume();
    // Fala vazia destrava a voz no Safari/Chrome do Android.
    if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  } catch {}
  return a.state === "running";
}

export function playChime(): Promise<void> {
  const a = audio();
  if (!a || a.state !== "running") return Promise.resolve();
  const notes = [784, 659, 523]; // sol, mi, dó
  const start = a.currentTime + 0.05;
  notes.forEach((f, i) => {
    const t = start + i * 0.45;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + 1.2);
  });
  return new Promise((r) => setTimeout(r, 1700));
}

function ptVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === "pt-BR") ?? voices.find((v) => v.lang.startsWith("pt")) ?? null;
}

export function speak(text: string): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    const v = ptVoice();
    if (v) u.voice = v;
    u.rate = 0.92;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
    // Rede de segurança: algumas TVs nunca disparam onend.
    setTimeout(resolve, 12_000);
  });
}
