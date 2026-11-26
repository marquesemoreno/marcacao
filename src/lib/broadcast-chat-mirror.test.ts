import { describe, expect, it } from "vitest";
import { campaignChatMirror, type MirrorCampaign } from "./broadcast-chat-mirror";

const base: MirrorCampaign = {
  messageTemplate: "Olá {{nome}}, temos novidades.",
  messageVariants: [],
  cloudTemplateName: null,
  cloudTemplateBody: null,
  cloudTemplateVariants: null,
  cloudTemplateParams: [],
  tagOnSend: null,
  imagePath: null,
  imageMimeType: null,
  attachmentName: null,
  technicalDirectorName: null,
  technicalDirectorCrm: null,
};

describe("campaignChatMirror", () => {
  it("modelo da API oficial: corpo com os {{n}} preenchidos", () => {
    const m = campaignChatMirror(
      { ...base, cloudTemplateName: "nov_azul", cloudTemplateBody: "Oi, {{1}}! Novembro Azul.", cloudTemplateParams: ["{{nome}}"] },
      { variables: { nome: "Valdevino" }, variantIndex: 0 },
    );
    expect(m.content).toBe("Oi, Valdevino! Novembro Azul.");
    expect(m.media).toBeNull();
  });

  it("modelo da API oficial: usa a variação que o paciente recebeu", () => {
    const m = campaignChatMirror(
      {
        ...base,
        cloudTemplateName: "a",
        cloudTemplateBody: "Texto A {{1}}",
        cloudTemplateVariants: [{ name: "b", language: "pt_BR", body: "Texto B {{1}}" }],
        cloudTemplateParams: ["{{nome|amigo}}"],
      },
      { variables: {}, variantIndex: 1 },
    );
    expect(m.content).toBe("Texto B amigo");
  });

  it("texto livre: variáveis, variação e rodapé como foi enviado", () => {
    const m = campaignChatMirror(
      { ...base, messageVariants: ["Oi {{nome}}, segunda versão."], technicalDirectorName: "Dr. X", technicalDirectorCrm: "CRM 1" },
      { variables: { nome: "Ana" }, variantIndex: 1 },
    );
    expect(m.content.startsWith("Oi Ana, segunda versão.")).toBe(true);
    expect(m.content).toContain("Responsável técnico: Dr. X — CRM 1");
  });

  it("foto da campanha vai junto", () => {
    const m = campaignChatMirror(
      { ...base, imagePath: "campanhas/x.jpg", imageMimeType: "image/jpeg" },
      { variables: { nome: "Ana" }, variantIndex: 0 },
    );
    expect(m.media).toEqual({ mediaPath: "campanhas/x.jpg", mimeType: "image/jpeg", attachmentName: "campanha.jpg" });
  });
});
