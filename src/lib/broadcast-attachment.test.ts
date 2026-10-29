import { describe, it, expect } from "vitest";
import { attachmentSummary, checkBroadcastAttachment, MAX_BROADCAST_ATTACHMENT_BYTES } from "./broadcast-attachment";

const file = (name: string, type: string, size = 1000) => ({ name, type, size });
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("checkBroadcastAttachment — tipos aceitos", () => {
  it("imagem continua funcionando", () => {
    expect(checkBroadcastAttachment(file("foto.jpg", "image/jpeg"))).toEqual({ ok: true, kind: "image", mimeType: "image/jpeg", fileName: "foto.jpg" });
    for (const [name, type] of [["a.png", "image/png"], ["a.webp", "image/webp"], ["a.gif", "image/gif"]]) {
      expect(checkBroadcastAttachment(file(name, type))).toMatchObject({ ok: true, kind: "image" });
    }
  });

  it("PDF vai como documento, mantendo o nome com espaços e acentos", () => {
    expect(checkBroadcastAttachment(file("Tabela de valores 2026.pdf", "application/pdf"))).toEqual({
      ok: true,
      kind: "document",
      mimeType: "application/pdf",
      fileName: "Tabela de valores 2026.pdf",
    });
  });

  it("Word e Excel (novos e antigos) vão como documento", () => {
    expect(checkBroadcastAttachment(file("Valores.xlsx", XLSX))).toMatchObject({ ok: true, kind: "document", mimeType: XLSX });
    expect(checkBroadcastAttachment(file("Valores.xls", "application/vnd.ms-excel"))).toMatchObject({ ok: true, kind: "document" });
    expect(checkBroadcastAttachment(file("Carta.docx", DOCX))).toMatchObject({ ok: true, kind: "document", mimeType: DOCX });
    expect(checkBroadcastAttachment(file("Carta.doc", "application/msword"))).toMatchObject({ ok: true, kind: "document" });
  });

  it("navegador sem tipo (ou octet-stream): descobre pela extensão", () => {
    expect(checkBroadcastAttachment(file("Valores.xlsx", ""))).toMatchObject({ ok: true, kind: "document", mimeType: XLSX });
    expect(checkBroadcastAttachment(file("Tabela.PDF", "application/octet-stream"))).toMatchObject({ ok: true, mimeType: "application/pdf" });
  });

  it("parâmetros no tipo são ignorados", () => {
    expect(checkBroadcastAttachment(file("a.pdf", "application/pdf; charset=binary"))).toMatchObject({ ok: true, mimeType: "application/pdf" });
  });

  it("recusa o que não é imagem, PDF, Word ou Excel, com mensagem clara", () => {
    for (const [name, type] of [
      ["x.zip", "application/zip"],
      ["setup.exe", "application/x-msdownload"],
      ["pagina.html", "text/html"],
      ["valores.csv", "text/csv"],
      ["video.mp4", "video/mp4"],
      ["semtipo.bin", ""],
    ]) {
      const out = checkBroadcastAttachment(file(name, type));
      expect(out.ok).toBe(false);
      expect((out as { error: string }).error).toMatch(/PDF/);
    }
  });
});

describe("checkBroadcastAttachment — tamanho", () => {
  it("recusa arquivo vazio", () => {
    const out = checkBroadcastAttachment(file("a.pdf", "application/pdf", 0));
    expect(out).toMatchObject({ ok: false });
    expect((out as { error: string }).error).toMatch(/vazio/i);
  });

  it("aceita até 15 MB e recusa acima", () => {
    expect(checkBroadcastAttachment(file("a.pdf", "application/pdf", MAX_BROADCAST_ATTACHMENT_BYTES))).toMatchObject({ ok: true });
    const out = checkBroadcastAttachment(file("a.pdf", "application/pdf", MAX_BROADCAST_ATTACHMENT_BYTES + 1));
    expect(out).toMatchObject({ ok: false });
    expect((out as { error: string }).error).toContain("15 MB");
  });
});

describe("checkBroadcastAttachment — nome do arquivo", () => {
  const name = (raw: string, type = "application/pdf") => (checkBroadcastAttachment(file(raw, type)) as { fileName: string }).fileName;

  it("tira o caminho que alguns navegadores mandam", () => {
    expect(name("C:\\Users\\Bruna\\Desktop\\Tabela.pdf")).toBe("Tabela.pdf");
    expect(name("../../etc/passwd.pdf")).toBe("passwd.pdf");
  });

  it("tira caracteres de controle e os proibidos em nome de arquivo", () => {
    expect(name("Ta\nbela.pdf")).toBe("Tabela.pdf");
    expect(name('a<b>:c"d|e?f*.pdf')).toBe("abcdef.pdf");
  });

  it("acrescenta a extensão quando falta e respeita maiúsculas", () => {
    expect(name("Tabela")).toBe("Tabela.pdf");
    expect(name("TABELA.PDF")).toBe("TABELA.PDF");
  });

  it("nome gigante é encurtado mantendo a extensão", () => {
    const out = name(`${"a".repeat(300)}.pdf`);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.endsWith(".pdf")).toBe(true);
  });

  it("nome vazio ganha um padrão pelo tipo do arquivo", () => {
    expect(name(".pdf")).toBe("documento.pdf");
    expect(name("")).toBe("documento.pdf");
    expect(name("", "image/png")).toBe("imagem.png");
  });
});

describe("attachmentSummary", () => {
  it("imagem e documento se descrevem diferente (o documento mostra o nome)", () => {
    expect(attachmentSummary({ kind: "image", fileName: "foto.jpg" })).toBe("Imagem");
    expect(attachmentSummary({ kind: "document", fileName: "Tabela.pdf" })).toBe("Documento: Tabela.pdf");
  });
});

import { broadcastMediaFile } from "./broadcast-attachment";

describe("broadcastMediaFile (o que vai para o envio)", () => {
  it("documento com nome guardado: usa o nome e o tipo da campanha", () => {
    expect(broadcastMediaFile({ imageMimeType: "application/pdf", attachmentName: "Tabela de valores.pdf" })).toEqual({
      mimeType: "application/pdf",
      fileName: "Tabela de valores.pdf",
    });
  });

  it("campanha antiga só com imagem (sem nome): mantém o comportamento de antes", () => {
    expect(broadcastMediaFile({ imageMimeType: "image/jpeg", attachmentName: null })).toEqual({ mimeType: "image/jpeg", fileName: "campanha.jpg" });
    expect(broadcastMediaFile({ imageMimeType: null, attachmentName: null })).toEqual({ mimeType: "image/jpeg", fileName: "campanha.jpg" });
  });

  it("imagem sem nome guardado leva a extensão do próprio tipo", () => {
    expect(broadcastMediaFile({ imageMimeType: "image/png", attachmentName: null }).fileName).toBe("campanha.png");
  });

  it("documento sem nome guardado (não deveria acontecer) ainda sai com um nome válido", () => {
    expect(broadcastMediaFile({ imageMimeType: "application/pdf", attachmentName: null }).fileName).toBe("documento.pdf");
  });
});
