import { describe, it, expect } from "vitest";
import { detectAcquisition, DIRECT_CHANNEL } from "./acquisition";

const adMessage = (sourceUrl: string, title = "Vasectomia sem dor") => ({
  message: {
    extendedTextMessage: {
      text: "Olá! Quero mais informações",
      contextInfo: { externalAdReply: { title, sourceUrl, sourceId: "120210000", sourceType: "ad" } },
    },
  },
});

describe("detectAcquisition", () => {
  it("anúncio de clique pro WhatsApp vindo do Instagram", () => {
    expect(detectAcquisition({ text: "Olá! Quero mais informações", data: adMessage("https://www.instagram.com/p/abc") }, [])).toEqual({
      channel: "Instagram Ads",
      detail: "Vasectomia sem dor",
      adId: "120210000",
    });
  });

  it("anúncio do Facebook (fb.me/facebook.com)", () => {
    expect(detectAcquisition({ text: "oi", data: adMessage("https://fb.me/xyz") }, []).channel).toBe("Facebook Ads");
  });

  it("externalAdReply no contextInfo de nível superior (formato alternativo da Evolution)", () => {
    const data = { contextInfo: { externalAdReply: { title: "Promo", sourceUrl: "https://instagram.com/x", sourceId: "9" } }, message: { conversation: "oi" } };
    expect(detectAcquisition({ text: "oi", data }, []).adId).toBe("9");
  });

  it("utm_source no texto pré-preenchido", () => {
    expect(detectAcquisition({ text: "Olá, vim do site utm_source=google&utm_medium=cpc" }, []).channel).toBe("Google Ads");
    expect(detectAcquisition({ text: "Olá utm_source=google" }, []).channel).toBe("Google Orgânico");
    expect(detectAcquisition({ text: "Olá utm_source=instagram" }, []).channel).toBe("Instagram Ads");
  });

  it("texto-chave cadastrado pela clínica, sem diferenciar caixa/acento", () => {
    const rules = [{ keyword: "promoção de check-up", channel: "Instagram Ads" }];
    expect(detectAcquisition({ text: "Oi! Vi a PROMOCAO DE CHECK-UP e quero agendar" }, rules)).toEqual({
      channel: "Instagram Ads",
      detail: "promoção de check-up",
      adId: null,
    });
  });

  it("texto do link do site Conecta Saúde", () => {
    expect(detectAcquisition({ text: "Olá! Encontrei a clínica no Conecta Saúde" }, []).channel).toBe("Site Conecta Saúde");
  });

  it("sem nenhum sinal cai em Indicação / Direto", () => {
    expect(detectAcquisition({ text: "Bom dia" }, [])).toEqual({ channel: DIRECT_CHANNEL, detail: null, adId: null });
  });

  it("palavra-chave genérica do Google Meu Negócio", () => {
    expect(detectAcquisition({ text: "Olá! Vim pelo Google e quero agendar uma consulta." }, []).channel).toBe(
      "Google Meu Negócio"
    );
    expect(detectAcquisition({ text: "Pesquisei no Google e achei vocês" }, []).channel).toBe("Google Meu Negócio");
    expect(detectAcquisition({ text: "vi o post #GMN de vocês" }, []).channel).toBe("Google Meu Negócio");
  });

  it("palavra-chave genérica do Instagram orgânico (distinto de Instagram Ads)", () => {
    expect(detectAcquisition({ text: "Vim pelo Instagram, quero agendar" }, []).channel).toBe("Instagram Orgânico");
    expect(detectAcquisition({ text: "vi no insta de vocês" }, []).channel).toBe("Instagram Orgânico");
    expect(detectAcquisition({ text: "vi nos stories" }, []).channel).toBe("Instagram Orgânico");
  });

  it("palavra-chave genérica do Facebook orgânico (distinto de Facebook Ads)", () => {
    expect(detectAcquisition({ text: "Vim pelo Facebook de vocês" }, []).channel).toBe("Facebook Orgânico");
  });

  it("regra específica da clínica vence a palavra-chave genérica", () => {
    const rules = [{ keyword: "vim pelo instagram", channel: "Instagram Ads" }];
    expect(detectAcquisition({ text: "Vim pelo Instagram, quero agendar" }, rules).channel).toBe("Instagram Ads");
  });

  it("UTM continua tendo prioridade sobre a palavra-chave genérica", () => {
    expect(detectAcquisition({ text: "Olá utm_source=google&utm_medium=cpc, vim pelo Google" }, []).channel).toBe(
      "Google Ads"
    );
  });
});
