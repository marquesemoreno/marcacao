/** Painel de chamada da TV da sala de espera — funções puras (ver src/actions/tv-call.ts).
 * A tela é pública: mostra só primeiro nome + inicial; a voz fala primeiro + último nome. */

const PARTICLES = new Set(["da", "de", "do", "das", "dos", "e"]);

function words(name: string): string[] {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** "LUCAS MARQUES MORENO" → "Lucas M." */
export function tvDisplayName(name: string): string {
  const w = words(name).filter((x, i) => i === 0 || !PARTICLES.has(x.toLowerCase()));
  if (w.length === 0) return "Paciente";
  return w.length === 1 ? w[0] : `${w[0]} ${w[w.length - 1][0]}.`;
}

/** "LUCAS MARQUES MORENO" → "Lucas Moreno" (o que a voz anuncia). */
export function tvSpokenName(name: string): string {
  const w = words(name).filter((x, i) => i === 0 || !PARTICLES.has(x.toLowerCase()));
  if (w.length === 0) return "Paciente";
  return w.length === 1 ? w[0] : `${w[0]} ${w[w.length - 1]}`;
}

/** Frase da chamada. "Sala"/"recepção" pedem "à"; consultório etc., "ao". */
export function tvSpokenText(call: { spokenName: string; room: string | null }): string {
  const room = call.room?.trim();
  const where = !room ? "à recepção" : /^(sala|recepç|recepc)/i.test(room) ? `à ${room}` : `ao ${room}`;
  return `Paciente ${call.spokenName}, favor dirigir-se ${where}.`;
}

/** Chave do médico pra sala fixa: o nome vem livre da ponte (caixa/acentos variam). */
export function doctorKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Sala da chamada: a escolhida na hora > a fixa do médico > nenhuma (vai pra recepção). */
export function resolveRoom(rooms: Map<string, string>, doctor: string | null, override: string | null): string | null {
  const o = override?.trim();
  if (o) return o;
  if (!doctor) return null;
  return rooms.get(doctorKey(doctor)) ?? null;
}

/** Histórico do rodapé: mais recente primeiro, sem repetir, no máximo `max`. */
export function pushCallHistory<T extends { id: string }>(list: T[], call: T, max = 5): T[] {
  return [call, ...list.filter((c) => c.id !== call.id)].slice(0, max);
}

/** Evento no canal da TV. Não leva nome: a TV busca a chamada pelo id com o token dela. */
export type TvCallSignal = { id: string };

/** O que a TV recebe ao buscar a chamada. */
export type TvCall = {
  id: string;
  displayName: string;
  spokenName: string;
  doctor: string | null;
  room: string | null;
  calledAt: string;
  attempt: number;
};
