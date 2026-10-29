/** Anexo das campanhas de WhatsApp (Disparos): imagem ou documento (PDF, Word, Excel) — a
 * recepção precisa mandar, por exemplo, uma tabela de valores. Funções puras (cliente e
 * servidor): o upload e o envio ficam em clinic-broadcast.ts e broadcast.ts. O envio já sabe
 * mandar documento (Evolution: mediatype "document"; API oficial: cloudMediaKind). */
export type BroadcastAttachmentKind = "image" | "document";

export const MAX_BROADCAST_ATTACHMENT_BYTES = 15 * 1024 * 1024; // mesmo limite da imagem e do inbox

/** Para o `accept` do <input type="file">. */
export const BROADCAST_ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.xls,.xlsx";

const TYPES: Record<string, { kind: BroadcastAttachmentKind; exts: string[] }> = {
  "image/jpeg": { kind: "image", exts: ["jpg", "jpeg"] },
  "image/png": { kind: "image", exts: ["png"] },
  "image/webp": { kind: "image", exts: ["webp"] },
  "image/gif": { kind: "image", exts: ["gif"] },
  "application/pdf": { kind: "document", exts: ["pdf"] },
  "application/msword": { kind: "document", exts: ["doc"] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { kind: "document", exts: ["docx"] },
  "application/vnd.ms-excel": { kind: "document", exts: ["xls"] },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { kind: "document", exts: ["xlsx"] },
};

const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(TYPES).flatMap(([mime, t]) => t.exts.map((ext) => [ext, mime]))
);

const UNSUPPORTED = "Tipo de arquivo não suportado. Envie uma imagem (JPEG, PNG, WEBP, GIF), PDF, Word ou Excel.";

function extensionOf(name: string): string | null {
  const m = name.match(/\.([A-Za-z0-9]+)$/);
  return m ? m[1] : null;
}

/** Nome que o paciente vê no WhatsApp: sem caminho, sem caracteres de controle nem os
 * proibidos em nome de arquivo, com a extensão certa e no máximo 100 caracteres. */
function cleanFileName(raw: string, mimeType: string, kind: BroadcastAttachmentKind): string {
  const exts = TYPES[mimeType].exts;
  const base = (raw.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "")
    .trim();
  const current = extensionOf(base);
  let stem: string;
  let ext: string;
  if (current && exts.includes(current.toLowerCase())) {
    stem = base.slice(0, -(current.length + 1));
    ext = current;
  } else {
    stem = base;
    ext = exts[0];
  }
  stem = stem.trim() || (kind === "image" ? "imagem" : "documento");
  const maxStem = 100 - ext.length - 1;
  if (stem.length > maxStem) stem = stem.slice(0, maxStem).trimEnd();
  return `${stem}.${ext}`;
}

export type BroadcastAttachmentCheck =
  | { ok: true; kind: BroadcastAttachmentKind; mimeType: string; fileName: string }
  | { ok: false; error: string };

/** Confere o arquivo escolhido (tipo, tamanho) e devolve o tipo final e o nome limpo. Navegador
 * sem tipo (comum com Excel no Windows) ou "octet-stream": descobre pela extensão. */
export function checkBroadcastAttachment(input: { name: string; type: string; size: number }): BroadcastAttachmentCheck {
  let mimeType = input.type.split(";")[0].trim().toLowerCase();
  if (!TYPES[mimeType]) {
    const fromExt = mimeType === "" || mimeType === "application/octet-stream" ? MIME_BY_EXT[(extensionOf(input.name) ?? "").toLowerCase()] : undefined;
    if (!fromExt) return { ok: false, error: UNSUPPORTED };
    mimeType = fromExt;
  }
  if (input.size <= 0) return { ok: false, error: "O arquivo está vazio." };
  if (input.size > MAX_BROADCAST_ATTACHMENT_BYTES) return { ok: false, error: "Arquivo muito grande. O limite é 15 MB." };
  const { kind } = TYPES[mimeType];
  return { ok: true, kind, mimeType, fileName: cleanFileName(input.name, mimeType, kind) };
}

/** Texto curto para a tela (prévia, cartão da campanha). */
export function attachmentSummary(input: { kind: BroadcastAttachmentKind; fileName: string }): string {
  return input.kind === "image" ? "Imagem" : `Documento: ${input.fileName}`;
}

/** Tipo do anexo a partir do mimeType guardado na campanha (null = sem anexo). */
export function attachmentKindOf(mimeType: string | null | undefined): BroadcastAttachmentKind | null {
  if (!mimeType) return null;
  return mimeType.toLowerCase().startsWith("image/") ? "image" : "document";
}

/** Tipo e nome com que o anexo da campanha vai para o envio. Campanha antiga (só imagem, sem
 * nome guardado) segue como antes: image/jpeg e "campanha.jpg". */
export function broadcastMediaFile(campaign: { imageMimeType: string | null; attachmentName: string | null }): { mimeType: string; fileName: string } {
  const mimeType = campaign.imageMimeType ?? "image/jpeg";
  if (campaign.attachmentName) return { mimeType, fileName: campaign.attachmentName };
  const known = TYPES[mimeType.split(";")[0].trim().toLowerCase()];
  const ext = known ? known.exts[0] : "jpg";
  return { mimeType, fileName: `${known?.kind === "document" ? "documento" : "campanha"}.${ext}` };
}
