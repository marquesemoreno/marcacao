import { describe, expect, it } from "vitest";
import { brasiliaDayStart, callOutcome, decideMissedCallRecovery, isRecoveryOpen, missedCallText, parseCallEvent } from "@/lib/missed-call";
import { findClinicalTerm } from "@/lib/clinic-automation-templates";

const t0 = new Date("2026-11-19T13:00:00.000Z"); // 10:00 em Brasília, quinta
const sec = (s: number) => new Date(t0.getTime() + s * 1000);

describe("callOutcome — a ligação pelo WhatsApp foi perdida?", () => {
  it("tocou até acabar o tempo: perdida", () => {
    expect(callOutcome([{ status: "offer", at: t0 }, { status: "timeout", at: sec(45) }], sec(50))).toBe("MISSED");
  });

  it("alguém atendeu (mesmo que depois termine): atendida", () => {
    expect(
      callOutcome([{ status: "offer", at: t0 }, { status: "accept", at: sec(10) }, { status: "terminate", at: sec(300) }], sec(301))
    ).toBe("ANSWERED");
  });

  it("recusada (pelo celular ou pela recusa automática): perdida", () => {
    expect(callOutcome([{ status: "offer", at: t0 }, { status: "reject", at: sec(5) }], sec(6))).toBe("MISSED");
  });

  it("quem ligou desistiu enquanto tocava (terminou antes de 60 s, sem atender): perdida", () => {
    expect(callOutcome([{ status: "offer", at: t0 }, { status: "terminate", at: sec(20) }], sec(21))).toBe("MISSED");
  });

  it("terminou depois de 60 s sem aviso de atendimento: não sabemos (pode ter sido atendida no celular)", () => {
    expect(callOutcome([{ status: "offer", at: t0 }, { status: "terminate", at: sec(240) }], sec(241))).toBe("UNKNOWN");
  });

  it("ainda tocando: espera", () => {
    expect(callOutcome([{ status: "offer", at: t0 }, { status: "ringing", at: sec(2) }], sec(30))).toBe("PENDING");
  });

  it("sem aviso de fim depois de 3 min: não sabemos", () => {
    expect(callOutcome([{ status: "offer", at: t0 }], sec(181))).toBe("UNKNOWN");
  });
});

const baseDecision = {
  now: sec(60),
  missedAt: sec(40),
  enabled: true,
  phone: "5573999990000",
  open: true,
  tags: [] as string[],
  isTeamNumber: false,
  answeredLater: false,
  lastTeamReplyAt: null as Date | null,
  lastRecoveryToNumberAt: null as Date | null,
  clinicSentLastHour: 0,
  clinicSentToday: 0,
  openTaskForNumber: false,
  paused: false,
};

describe("decideMissedCallRecovery — manda, só cria tarefa ou ignora?", () => {
  it("em horário comercial, espera 2 min depois da ligação antes de mandar", () => {
    expect(decideMissedCallRecovery(baseDecision)).toEqual({ action: "WAIT", until: sec(40 + 120) });
  });

  it("passados os 2 min, manda", () => {
    expect(decideMissedCallRecovery({ ...baseDecision, now: sec(40 + 120) })).toEqual({ action: "SEND" });
  });

  it("fora do horário, manda na hora", () => {
    expect(decideMissedCallRecovery({ ...baseDecision, open: false })).toEqual({ action: "SEND" });
  });

  const later = { ...baseDecision, now: sec(200) };

  it("desligado na clínica: ignora", () => {
    expect(decideMissedCallRecovery({ ...later, enabled: false })).toEqual({ action: "SKIP", reason: "DESLIGADO" });
  });

  it("número escondido pelo WhatsApp: ignora (não há para quem mandar nem retornar)", () => {
    expect(decideMissedCallRecovery({ ...later, phone: null })).toEqual({ action: "SKIP", reason: "NUMERO_OCULTO" });
  });

  it("ligou de novo e foi atendida (ou a recepção retornou): ignora", () => {
    expect(decideMissedCallRecovery({ ...later, answeredLater: true })).toEqual({ action: "SKIP", reason: "ATENDIDA_DEPOIS" });
  });

  it("não é paciente ou número errado: ignora", () => {
    expect(decideMissedCallRecovery({ ...later, tags: ["🚫 Não é paciente"] })).toEqual({ action: "SKIP", reason: "NAO_PACIENTE" });
    expect(decideMissedCallRecovery({ ...later, tags: ["📵 Número errado"] })).toEqual({ action: "SKIP", reason: "NUMERO_ERRADO" });
  });

  it("número da equipe: ignora", () => {
    expect(decideMissedCallRecovery({ ...later, isTeamNumber: true })).toEqual({ action: "SKIP", reason: "EQUIPE" });
  });

  it("a equipe respondeu a conversa nos últimos 30 min: ignora (já estão falando)", () => {
    expect(decideMissedCallRecovery({ ...later, lastTeamReplyAt: new Date(sec(200).getTime() - 29 * 60_000) })).toEqual({
      action: "SKIP",
      reason: "CONVERSA_RECENTE",
    });
    expect(decideMissedCallRecovery({ ...later, lastTeamReplyAt: new Date(sec(200).getTime() - 31 * 60_000) })).toEqual({ action: "SEND" });
  });

  it("já mandamos para esse número nas últimas 24 h: ignora (várias tentativas contam como uma)", () => {
    expect(decideMissedCallRecovery({ ...later, lastRecoveryToNumberAt: new Date(sec(200).getTime() - 23 * 3600_000) })).toEqual({
      action: "SKIP",
      reason: "JA_ENVIADO_24H",
    });
    expect(decideMissedCallRecovery({ ...later, lastRecoveryToNumberAt: new Date(sec(200).getTime() - 25 * 3600_000) })).toEqual({ action: "SEND" });
  });

  it("teto da clínica: a 4ª na mesma hora e a 21ª do dia viram só tarefa", () => {
    expect(decideMissedCallRecovery({ ...later, clinicSentLastHour: 3 })).toEqual({ action: "TASK", reason: "TETO_HORA" });
    expect(decideMissedCallRecovery({ ...later, clinicSentLastHour: 2, clinicSentToday: 20 })).toEqual({ action: "TASK", reason: "TETO_DIA" });
    expect(decideMissedCallRecovery({ ...later, clinicSentLastHour: 2, clinicSentToday: 19 })).toEqual({ action: "SEND" });
  });

  it("envios automáticos pausados na clínica: só tarefa", () => {
    expect(decideMissedCallRecovery({ ...later, paused: true })).toEqual({ action: "TASK", reason: "PAUSADO" });
  });

  it("não cria segunda tarefa para o mesmo número", () => {
    expect(decideMissedCallRecovery({ ...later, paused: true, openTaskForNumber: true })).toEqual({ action: "SKIP", reason: "TAREFA_ABERTA" });
  });
});

describe("missedCallText — o texto convida a responder", () => {
  it("aberto, número confiável e nome conhecido: usa o primeiro nome e convida a escrever", () => {
    const text = missedCallText({ firstName: "Maria", trustedNumber: true, clinicName: "Urolaser", open: true });
    expect(text).toBe(
      "Oi, Maria! Vimos sua ligação para a Urolaser e não conseguimos atender agora. Como podemos ajudar? Pode responder por aqui que já falamos com você."
    );
  });

  it("número não confiável (telefone comum): nunca usa o nome", () => {
    const text = missedCallText({ firstName: "Maria", trustedNumber: false, clinicName: "Urolaser", open: true });
    expect(text.startsWith("Olá! Vimos sua ligação")).toBe(true);
    expect(text).not.toContain("Maria");
  });

  it("fora do horário: avisa que está fechado e pede para deixar a mensagem", () => {
    expect(missedCallText({ firstName: null, trustedNumber: true, clinicName: "Santa Clara", open: false })).toBe(
      "Olá! Recebemos sua ligação para a Santa Clara, mas estamos fora do horário de atendimento. Deixe sua mensagem por aqui e retornamos assim que abrirmos."
    );
  });

  it("nenhum texto tem termo clínico", () => {
    for (const open of [true, false]) {
      expect(findClinicalTerm(missedCallText({ firstName: "Ana", trustedNumber: true, clinicName: "Clínica", open }))).toBeNull();
    }
  });
});

describe("parseCallEvent — aviso CALL da Evolution", () => {
  it("lê id, situação, hora e telefone de quem ligou", () => {
    expect(
      parseCallEvent({ id: "C1", from: "5573999990000@s.whatsapp.net", status: "offer", date: "2026-11-19T13:00:00.000Z", isGroup: false, isVideo: false })
    ).toEqual({ callId: "C1", status: "offer", at: t0, phone: "5573999990000", isVideo: false });
  });

  it("número escondido (@lid): usa o telefone real se vier junto, senão fica sem telefone", () => {
    expect(parseCallEvent({ id: "C2", from: "123456@lid", status: "offer", date: t0.toISOString() })?.phone).toBeNull();
    expect(
      parseCallEvent({ id: "C2", from: "123456@lid", callerPn: "5573999990000@s.whatsapp.net", status: "offer", date: t0.toISOString() })?.phone
    ).toBe("5573999990000");
  });

  it("ignora chamada de grupo e aviso sem id", () => {
    expect(parseCallEvent({ id: "C3", from: "5573999990000@s.whatsapp.net", status: "offer", isGroup: true })).toBeNull();
    expect(parseCallEvent({ from: "5573999990000@s.whatsapp.net", status: "offer" })).toBeNull();
  });
});

describe("horário e dia no fuso do Brasil", () => {
  it("aberto de 08h às 18h, segunda a sábado, sem feriado", () => {
    expect(isRecoveryOpen(new Date("2026-11-19T11:00:00.000Z"))).toBe(true); // qui 08:00
    expect(isRecoveryOpen(new Date("2026-11-19T10:59:00.000Z"))).toBe(false); // qui 07:59
    expect(isRecoveryOpen(new Date("2026-11-19T21:00:00.000Z"))).toBe(false); // qui 18:00
    expect(isRecoveryOpen(new Date("2026-11-22T13:00:00.000Z"))).toBe(false); // domingo
    expect(isRecoveryOpen(new Date("2026-12-25T13:00:00.000Z"))).toBe(false); // Natal
  });

  it("o dia começa à meia-noite de Brasília (03:00 UTC)", () => {
    expect(brasiliaDayStart(new Date("2026-11-19T02:30:00.000Z"))).toEqual(new Date("2026-11-18T03:00:00.000Z"));
    expect(brasiliaDayStart(new Date("2026-11-19T03:30:00.000Z"))).toEqual(new Date("2026-11-19T03:00:00.000Z"));
  });
});

