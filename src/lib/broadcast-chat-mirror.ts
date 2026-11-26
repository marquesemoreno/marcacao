import { buildBroadcastMessage, technicalDirectorLine } from "@/lib/broadcast-csv";
import { buildTemplateParams, parseCloudTemplateVariants, renderTemplatePreview } from "@/lib/broadcast-cloud-template";
import { broadcastMediaFile } from "@/lib/broadcast-attachment";
import { RESCHEDULE_PENDING_TAG } from "@/lib/conversation-tags";

/** Mensagem de campanha no Chat. O disparo não grava nada na conversa (2.600 envios
 * encheriam a fila); quando o paciente responde, a mensagem que ele recebeu entra no
 * histórico logo antes da resposta — a recepção vê a que ele está respondendo. */

/** Há quanto tempo o envio pode ter sido para ainda contar como "respondendo à campanha". */
export const CAMPAIGN_MIRROR_WINDOW_DAYS = 30;

export type MirrorCampaign = {
  messageTemplate: string;
  messageVariants: string[];
  cloudTemplateName: string | null;
  cloudTemplateBody: string | null;
  cloudTemplateVariants: unknown;
  cloudTemplateParams: string[];
  tagOnSend: string | null;
  imagePath: string | null;
  imageMimeType: string | null;
  attachmentName: string | null;
  technicalDirectorName: string | null;
  technicalDirectorCrm: string | null;
};

export type CampaignChatMirror = {
  content: string;
  media: { mediaPath: string; mimeType: string; attachmentName: string } | null;
};

/** Texto (e anexo) como o paciente recebeu. Mesma montagem de dispatchNextBatch. */
export function campaignChatMirror(
  campaign: MirrorCampaign,
  recipient: { variables: Record<string, string>; variantIndex: number | null },
): CampaignChatMirror {
  const index = recipient.variantIndex ?? 0;
  let content: string;
  if (campaign.cloudTemplateName && campaign.cloudTemplateBody) {
    const body = index > 0 ? parseCloudTemplateVariants(campaign.cloudTemplateVariants)[index - 1]?.body ?? campaign.cloudTemplateBody : campaign.cloudTemplateBody;
    const built = buildTemplateParams(campaign.cloudTemplateParams, recipient.variables);
    content = built.ok ? renderTemplatePreview(body, built.params) : body;
  } else {
    const variants = [campaign.messageTemplate, ...campaign.messageVariants];
    const text = variants[index]?.trim() ? variants[index] : campaign.messageTemplate;
    content = buildBroadcastMessage(text, recipient.variables, {
      technicalDirector:
        campaign.tagOnSend === RESCHEDULE_PENDING_TAG ? null : technicalDirectorLine(campaign.technicalDirectorName, campaign.technicalDirectorCrm),
    });
  }
  const media = campaign.imagePath
    ? (() => {
        const file = broadcastMediaFile(campaign);
        return { mediaPath: campaign.imagePath, mimeType: file.mimeType, attachmentName: file.fileName };
      })()
    : null;
  return { content, media };
}
