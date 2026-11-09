/** Cor do avatar de iniciais por paciente (09/11/2026): sem foto, todo cartão ficava com o
 * mesmo círculo cinza. A cor sai de um hash do id — a mesma pessoa tem sempre a mesma cor,
 * em qualquer tela. Classes escritas por extenso para o Tailwind encontrar. */
export const AVATAR_TONES = [
  "bg-gradient-to-br from-sky-400 to-blue-600 text-white",
  "bg-gradient-to-br from-emerald-400 to-teal-600 text-white",
  "bg-gradient-to-br from-violet-400 to-indigo-600 text-white",
  "bg-gradient-to-br from-amber-300 to-orange-500 text-white",
  "bg-gradient-to-br from-rose-400 to-pink-600 text-white",
  "bg-gradient-to-br from-cyan-400 to-sky-600 text-white",
  "bg-gradient-to-br from-lime-400 to-emerald-600 text-white",
  "bg-gradient-to-br from-fuchsia-400 to-purple-600 text-white",
] as const;

export type AvatarTone = (typeof AVATAR_TONES)[number];

export function avatarTone(seed: string): AvatarTone {
  // FNV-1a 32 bits: rápido, estável e espalha bem ids parecidos.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return AVATAR_TONES[(h >>> 0) % AVATAR_TONES.length];
}
