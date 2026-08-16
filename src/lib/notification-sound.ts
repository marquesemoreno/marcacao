"use client";

/**
 * Toca um "beep" curto e sutil (dois tons subindo) via Web Audio API.
 * Não depende de nenhum arquivo .mp3/.wav externo — gera o som na hora.
 */
export function playNotificationSound() {
  if (typeof window === "undefined") return;

  const AudioContextClass =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const playTone = (frequency: number, start: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.08, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + start);
      oscillator.stop(now + start + duration);
    };

    playTone(660, 0, 0.12);
    playTone(880, 0.1, 0.15);

    setTimeout(() => ctx.close(), 500);
  } catch {
    // Ambiente sem suporte a áudio (ex: aba em background em alguns
    // navegadores) — falha silenciosa, não é crítico.
  }
}
