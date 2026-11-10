import { describe, it, expect } from "vitest";
import { detectAcquisition } from "./acquisition";
import {
  extractClickRef,
  stripTrackingCodes,
  parseClickPayload,
  buildFbc,
  buildMetaEvent,
  buildGoogleAdsCsv,
  computeLeadOutcome,
} from "./ad-tracking";

/** Textos reais que o site da Urolaser (public/assets/track.js) e o GBP geram. */
describe("códigos de origem do site da Urolaser", () => {
  const cases: [string, string, string | null][] = [
    ["Olá! Vim pelo site e quero agendar uma consulta. #site-home", "Site da Clínica", "home"],
    ["Olá! Quero agendar uma consulta de Urologia. #site-urologia", "Site da Clínica", "urologia"],
    ["Olá! Li o artigo e quero agendar. #site-artigo-biopsia-de-prostata", "Site da Clínica", "artigo biopsia de prostata"],
    ["Olá! Vim pelo site (Novembro Azul). #site-novembro-azul", "Site da Clínica", "novembro azul"],
    ["Olá! Vim pelo Google e quero agendar. #gads-check-up-masculino ref:223z8h", "Google Ads", "check up masculino"],
    ["Olá! Vim pelo Google e quero agendar uma consulta. #gmn-perfil", "Google Meu Negócio", "perfil"],
    ["Olá! Vim pelo Google e quero agendar. #gmn-site", "Google Meu Negócio", "site"],
    ["Olá! Vim pelo Instagram e quero agendar. #ig-bio", "Instagram Orgânico", "bio"],
    ["Olá! Vim pelo Facebook e quero agendar. #fb-pagina", "Facebook Orgânico", "pagina"],
    ["Olá! Vim pelo Instagram. #igads-novembro", "Instagram Ads", "novembro"],
    ["Olá! Vim pelo Facebook. #fbads-novembro", "Facebook Ads", "novembro"],
  ];
  it.each(cases)("%s", (text, channel, detail) => {
    expect(detectAcquisition({ text }, [])).toEqual({ channel, detail, adId: null });
  });

  it("código no fim da frase com ponto final não leva o ponto", () => {
    expect(detectAcquisition({ text: "Quero agendar #site-home." }, []).detail).toBe("home");
  });

  it("o código vence a frase genérica 'Vim pelo Google'", () => {
    expect(detectAcquisition({ text: "Vim pelo Google #gads-x" }, []).channel).toBe("Google Ads");
  });
});

describe("extractClickRef", () => {
  it("lê o token ref:xxxxxx (alfabeto do track.js)", () => {
    expect(extractClickRef("Olá #gads-teste ref:223z8h")).toBe("223z8h");
    expect(extractClickRef("REF:AB23CD")).toBe("ab23cd");
  });
  it("ignora tamanho errado e texto sem token", () => {
    expect(extractClickRef("ref:12345")).toBeNull();
    expect(extractClickRef("ref:1234567")).toBeNull();
    expect(extractClickRef("preferência")).toBeNull();
  });
});

describe("stripTrackingCodes", () => {
  it("tira código de origem, ref e utm do texto exibido", () => {
    expect(stripTrackingCodes("Olá! Vim pelo Google e quero agendar. #gads-teste ref:223z8h")).toBe(
      "Olá! Vim pelo Google e quero agendar.",
    );
    expect(stripTrackingCodes("Olá! utm_source=meta&utm_medium=paid&utm_campaign=x")).toBe("Olá!");
    expect(stripTrackingCodes("Quero agendar #site-home.")).toBe("Quero agendar.");
  });
  it("não mexe em texto normal nem em hashtag comum", () => {
    expect(stripTrackingCodes("Bom dia #novembroazul")).toBe("Bom dia #novembroazul");
  });
});

describe("parseClickPayload", () => {
  const ok = {
    token: "223z8h",
    landing: "/artigos/biopsia",
    referrer: "https://google.com",
    ts: "2026-11-09T12:00:00.000Z",
    params: { utm_source: "google", utm_medium: "cpc", utm_campaign: "check-up", gclid: "Cj0KCQ_abc-123" },
  };
  it("aceita o corpo do track.js e guarda só o mínimo (sem página nem referrer)", () => {
    expect(parseClickPayload(ok)).toEqual({
      token: "223z8h",
      gclid: "Cj0KCQ_abc-123",
      gbraid: null,
      wbraid: null,
      fbclid: null,
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "check-up",
      utmContent: null,
      utmTerm: null,
    });
  });
  it("recusa sem token válido ou sem nenhum identificador de clique", () => {
    expect(parseClickPayload({ ...ok, token: "x" })).toBeNull();
    expect(parseClickPayload({ ...ok, params: { utm_source: "google" } })).toBeNull();
    expect(parseClickPayload(null)).toBeNull();
    expect(parseClickPayload("oi")).toBeNull();
  });
  it("recusa identificador com caractere estranho e corta texto longo", () => {
    expect(parseClickPayload({ ...ok, params: { gclid: "<script>" } })).toBeNull();
    const long = parseClickPayload({ ...ok, params: { gclid: "a".repeat(150), utm_campaign: "c".repeat(300) } });
    expect(long?.utmCampaign).toHaveLength(100);
  });
});

describe("Meta Conversions API", () => {
  it("fbc no formato fb.1.<ms do clique>.<fbclid>", () => {
    expect(buildFbc("IwAR1x", new Date("2026-11-09T12:00:00Z"))).toBe("fb.1.1794225600000.IwAR1x");
  });
  it("evento só com nome, hora, id e fbc — sem dado clínico, URL ou telefone", () => {
    const ev = buildMetaEvent({
      eventName: "Lead",
      eventId: "conv1:SCHEDULED",
      occurredAt: new Date("2026-11-09T15:00:00Z"),
      fbclid: "IwAR1x",
      clickedAt: new Date("2026-11-09T12:00:00Z"),
    });
    expect(ev).toEqual({
      event_name: "Lead",
      event_time: 1794236400,
      event_id: "conv1:SCHEDULED",
      action_source: "system_generated",
      user_data: { fbc: "fb.1.1794225600000.IwAR1x" },
    });
  });
});

describe("planilha de conversões offline do Google Ads", () => {
  it("formato de importação com fuso e só gclid", () => {
    const csv = buildGoogleAdsCsv([
      { gclid: "Cj0a", conversionName: "Agendamento", occurredAt: new Date("2026-11-09T15:04:05Z") },
      { gclid: "Cj0b,x", conversionName: "Comparecimento", occurredAt: new Date("2026-11-10T13:00:00Z") },
    ]);
    expect(csv.split("\n")).toEqual([
      "Parameters:TimeZone=-0300",
      "Google Click ID,Conversion Name,Conversion Time",
      "Cj0a,Agendamento,2026-11-09 12:04:05",
      '"Cj0b,x",Comparecimento,2026-11-10 10:00:00',
      "",
    ]);
  });
});

describe("computeLeadOutcome", () => {
  const since = new Date("2026-11-01T10:00:00Z");
  it("agendou pela etapa do CRM e compareceu pela Agenda (mesmo telefone)", () => {
    const r = computeLeadOutcome({
      since,
      phoneTail: "99257550",
      stageScheduledAt: new Date("2026-11-02T10:00:00Z"),
      appointments: [],
      reminders: [],
      marks: [{ phone: "5577999257550", date: new Date("2026-11-05T00:00:00Z"), updatedAt: new Date("2026-11-05T13:00:00Z") }],
    });
    expect(r).toEqual({ scheduledAt: new Date("2026-11-02T10:00:00Z"), attendedAt: new Date("2026-11-05T13:00:00Z") });
  });
  it("agendamento do Conecta conta; marcação de outro telefone ou anterior ao contato não", () => {
    const r = computeLeadOutcome({
      since,
      phoneTail: "99257550",
      stageScheduledAt: null,
      appointments: [{ patientPhone: "77999257550", createdAt: new Date("2026-11-03T10:00:00Z"), status: "PENDING", updatedAt: new Date("2026-11-03T10:00:00Z") }],
      reminders: [],
      marks: [
        { phone: "77911112222", date: new Date("2026-11-05T00:00:00Z"), updatedAt: new Date("2026-11-05T13:00:00Z") },
        { phone: "77999257550", date: new Date("2026-10-20T00:00:00Z"), updatedAt: new Date("2026-10-20T13:00:00Z") },
      ],
    });
    expect(r).toEqual({ scheduledAt: new Date("2026-11-03T10:00:00Z"), attendedAt: null });
  });
  it("compareceu sem agendamento registrado: agendamento = comparecimento", () => {
    const at = new Date("2026-11-04T12:00:00Z");
    const r = computeLeadOutcome({
      since,
      phoneTail: "99257550",
      stageScheduledAt: null,
      appointments: [],
      reminders: [],
      marks: [{ phone: "77999257550", date: new Date("2026-11-04T00:00:00Z"), updatedAt: at }],
    });
    expect(r).toEqual({ scheduledAt: at, attendedAt: at });
  });
  it("lembrete da agenda da clínica (ponte) também prova o agendamento", () => {
    const r = computeLeadOutcome({
      since,
      phoneTail: "99257550",
      stageScheduledAt: null,
      appointments: [],
      reminders: [{ phone: "5577999257550", sentAt: new Date("2026-11-06T11:00:00Z") }],
      marks: [],
    });
    expect(r.scheduledAt).toEqual(new Date("2026-11-06T11:00:00Z"));
  });
});
