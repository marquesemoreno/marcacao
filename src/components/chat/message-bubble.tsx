"use client";

import React, { useRef, useState } from 'react';
import { Message } from '@/types/chat-crm';
import {
  Play,
  Pause,
  Lock,
  CheckCheck,
  FileText,
  FileSpreadsheet,
  FileArchive,
  Copy,
  Check,
  Download,
  ZoomIn,
  X,
  Image as ImageIcon,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';

interface MessageBubbleProps {
  message: Message;
  /** Reenvia essa mensagem (só relevante quando deliveryStatus === 'failed'). */
  onRetry?: () => void;
  /** Manda um texto pedindo pro paciente reenviar o arquivo (só relevante quando mediaDownloadFailed). */
  onRequestResend?: () => void;
}

/** Ícone + cor por tipo de arquivo — em vez de um FileText genérico pra qualquer
 * anexo, ajuda a reconhecer o tipo (PDF, planilha, compactado) sem precisar abrir. */
function getAttachmentTypeStyle(mimeType?: string, fileName?: string) {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return { Icon: FileText, classes: 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400' };
  }
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext || '')) {
    return { Icon: FileSpreadsheet, classes: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' };
  }
  if (mimeType?.includes('word') || ['doc', 'docx'].includes(ext || '')) {
    return { Icon: FileText, classes: 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' };
  }
  if (mimeType?.includes('zip') || mimeType?.includes('compressed') || ['zip', 'rar', '7z'].includes(ext || '')) {
    return { Icon: FileArchive, classes: 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400' };
  }
  return { Icon: FileText, classes: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' };
}

/** Aviso + botão de reenviar pra mensagens que falharam ao sair — sem isso o
 * atendente só via um ícone vermelho sem explicação nem como corrigir. */
const FailedSendNotice: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <div className="mt-1 flex items-center justify-end gap-1.5 text-[10.5px] font-semibold text-red-100">
    <span>Falha ao enviar.</span>
    {onRetry && (
      <button onClick={onRetry} className="underline decoration-red-100/70 hover:text-white" type="button">
        Reenviar
      </button>
    )}
  </div>
);

/** Tiques de status real de entrega (WhatsApp): relógio (pendente), 1 tique (enviado),
 * 2 tiques cinza (entregue), 2 tiques azuis (lido), alerta (falhou). */
const MessageStatusTicks: React.FC<{ status?: Message['deliveryStatus'] }> = ({ status }) => {
  // aria-label existe porque "entregue" e "lida" só se diferenciam pela cor do
  // ícone (verde vs. azul, mesmo CheckCheck) — sem texto, fica invisível pra
  // leitor de tela e difícil de distinguir por daltonismo.
  if (status === 'failed') return <AlertCircle className="w-3.5 h-3.5 text-red-300" aria-label="Falha ao enviar" />;
  if (status === 'read') return <CheckCheck className="w-3.5 h-3.5 text-sky-300" aria-label="Lida pelo paciente" />;
  if (status === 'delivered') return <CheckCheck className="w-3.5 h-3.5 text-emerald-200" aria-label="Entregue" />;
  if (status === 'sent') return <Check className="w-3.5 h-3.5 text-emerald-200" aria-label="Enviada" />;
  return <Clock className="w-3 h-3 text-emerald-200/80" aria-label="Enviando..." />;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onRetry, onRequestResend }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<'1x' | '1.5x' | '2x'>('1x');
  const [copied, setCopied] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Texto copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  const speedValues: Record<'1x' | '1.5x' | '2x', number> = { '1x': 1, '1.5x': 1.5, '2x': 2 };

  const cycleSpeed = () => {
    const next = playbackSpeed === '1x' ? '1.5x' : playbackSpeed === '1.5x' ? '2x' : '1x';
    setPlaybackSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = speedValues[next];
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  };

  // 1. Nota Interna
  if (message.type === 'internal_note') {
    return (
      <div className="flex justify-center my-3.5 w-full px-2 sm:px-4 animate-in fade-in slide-in-from-bottom-2 duration-200" data-od-id={`internal-note-${message.id}`}>
        <div className="max-w-xl w-full bg-amber-50/95 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs text-amber-950 dark:text-amber-200 text-xs sm:text-sm space-y-2 relative group">
          <div className="flex items-center justify-between pb-2 border-b border-amber-200/70 dark:border-amber-800/60">
            <span className="inline-flex items-center gap-1.5 font-bold text-[11px] text-amber-800 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-900/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
              <Lock className="w-3 h-3 text-amber-700 dark:text-amber-400" />
              🔒 Nota Interna (Equipe)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => message.text && handleCopyText(message.text)}
                aria-label="Copiar nota"
                className="opacity-0 group-hover:opacity-100 p-2 -m-1 text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-opacity rounded"
                title="Copiar nota"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80 font-mono font-medium">{message.timestamp}</span>
            </div>
          </div>
          <p className="leading-relaxed text-amber-950 dark:text-amber-100 font-sans text-xs sm:text-sm whitespace-pre-wrap">{message.text}</p>
          {message.senderName && (
            <div className="pt-1 text-[11px] text-amber-800/80 dark:text-amber-300/80 flex items-center justify-end font-semibold font-mono">
              — {message.senderName}
            </div>
          )}
        </div>
      </div>
    );
  }

  const isAgent = message.sender === 'agent';

  // 1.1 Badge discreto de mídia que falhou ao baixar (não polui o histórico como bolha normal)
  if (message.mediaDownloadFailed) {
    return (
      <div className="flex justify-center my-2 w-full px-2 sm:px-4" data-od-id={`media-failed-${message.id}`}>
        <div className="inline-flex max-w-md items-center gap-2 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 pl-3 pr-1.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="truncate text-[11px] text-amber-800 dark:text-amber-300" title={message.text}>
            {message.text}
          </span>
          {onRequestResend && (
            <button
              type="button"
              onClick={onRequestResend}
              className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/60 hover:bg-amber-200 dark:hover:bg-amber-800 px-2.5 py-1 text-[10.5px] font-bold text-amber-900 dark:text-amber-200 transition-colors"
            >
              Solicitar reenvio
            </button>
          )}
        </div>
      </div>
    );
  }

  // 1.2 Aviso compacto de mensagem automática do sistema (ex: confirmação de agendamento)
  if (message.isSystemNotice) {
    return (
      <div className="flex justify-center my-2 w-full px-2 sm:px-4" data-od-id={`system-notice-${message.id}`}>
        <div className="flex max-w-xs sm:max-w-sm items-start gap-2 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] leading-snug font-medium text-emerald-800 dark:text-emerald-300">{message.text}</p>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-700/70 dark:text-emerald-400/70 font-mono">
              <span>{message.timestamp}</span>
              {isAgent && <MessageStatusTicks status={message.deliveryStatus} />}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Balão de Áudio
  if (message.type === 'audio') {
    const defaultWaveform = [30, 45, 80, 60, 40, 75, 90, 65, 35, 50, 70, 85, 40, 60, 95, 80, 55, 30, 45, 60];
    const waveform = message.audioWaveform || defaultWaveform;
    const hasRealAudio = Boolean(message.mediaUrl);

    return (
      <div
        className={`flex w-full mb-3 animate-in fade-in slide-in-from-bottom-1 duration-150 ${isAgent ? 'justify-end' : 'justify-start'}`}
        data-od-id={`audio-msg-${message.id}`}
      >
        <div
          className={`max-w-md w-72 sm:w-80 rounded-2xl p-3 sm:p-3.5 shadow-2xs transition-all ${
            isAgent
              ? 'bg-emerald-600 dark:bg-emerald-700 text-white rounded-tr-xs'
              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-xs hover:border-slate-300 dark:hover:border-slate-600'
          }`}
        >
          {hasRealAudio && (
            <audio
              ref={audioRef}
              src={message.mediaUrl}
              preload="metadata"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => {
                setIsPlaying(false);
                setProgress(0);
              }}
              onTimeUpdate={(e) => {
                const audio = e.currentTarget;
                if (audio.duration) setProgress(audio.currentTime / audio.duration);
              }}
              className="hidden"
            />
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={togglePlayback}
              disabled={!hasRealAudio}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 shrink-0 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed ${
                isAgent
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-400'
              }`}
              title={!hasRealAudio ? 'Áudio indisponível' : isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current animate-pulse" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <div className="flex-1 flex flex-col justify-center gap-1.5">
              <div className="flex items-center gap-1 h-7">
                {waveform.map((height, idx) => {
                  const active = idx < waveform.length * progress;
                  return (
                    <div
                      key={idx}
                      className={`w-1 rounded-full transition-all duration-200 ${
                        isAgent
                          ? active ? 'bg-white' : 'bg-emerald-400/60'
                          : active ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                      style={{ height: `${Math.max(16, height * 0.28)}px` }}
                    />
                  );
                })}
              </div>

              <div className="flex justify-between items-center text-[10.5px] opacity-85 font-mono">
                <div className="flex items-center gap-2">
                  <span>{message.audioDuration || '--:--'}</span>
                  {/* Seletor de Velocidade */}
                  <button
                    onClick={cycleSpeed}
                    disabled={!hasRealAudio}
                    className={`px-1.5 py-0.5 rounded font-mono font-extrabold text-[10px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      isAgent
                        ? 'bg-emerald-700 dark:bg-emerald-800 hover:bg-emerald-800 text-emerald-100'
                        : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                    }`}
                    title="Alternar velocidade de reprodução (1x, 1.5x, 2x)"
                  >
                    {playbackSpeed}
                  </button>
                </div>

                <span className="flex items-center gap-1">
                  {message.timestamp}
                  {isAgent && <MessageStatusTicks status={message.deliveryStatus} />}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Balão de Anexo / Imagem / Documento
  if (message.type === 'attachment') {
    const isImage = Boolean(message.mimeType?.startsWith('image/'));
    const fileName = message.attachmentName || (isImage ? 'imagem.jpg' : 'documento');
    const fileSize = message.attachmentSize || '';
    const hasRealFile = Boolean(message.mediaUrl);
    const { Icon: FileTypeIcon, classes: fileTypeClasses } = getAttachmentTypeStyle(message.mimeType, fileName);

    return (
      <>
        <div
          className={`flex w-full mb-3 animate-in fade-in slide-in-from-bottom-1 duration-150 ${isAgent ? 'justify-end' : 'justify-start'}`}
          data-od-id={`attachment-msg-${message.id}`}
        >
          <div
            className={`max-w-md rounded-2xl p-3.5 shadow-2xs transition-all ${hasRealFile ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'} ${
              isAgent
                ? 'bg-emerald-600 dark:bg-emerald-700 text-white rounded-tr-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-xs hover:border-slate-300 dark:hover:border-slate-600'
            }`}
            onClick={() => hasRealFile && setIsLightboxOpen(true)}
          >
            {isImage && hasRealFile ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={message.mediaUrl}
                alt={fileName}
                className="mb-2 max-h-64 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 mb-2 border border-black/5 dark:border-white/10 hover:bg-black/10 transition-colors">
                <div className={`p-2 rounded-lg ${fileTypeClasses}`}>
                  <FileTypeIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{fileName}</p>
                  <p className="text-[10px] opacity-80 font-mono">
                    {fileSize || (hasRealFile ? '' : 'Anexo indisponível')}
                  </p>
                </div>
                {hasRealFile && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <a
                      href={message.mediaUrl}
                      download={fileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Baixar arquivo"
                      title="Baixar arquivo"
                      className={`p-1.5 rounded-lg transition-colors ${isAgent ? 'hover:bg-white/20' : 'hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                    >
                      <Download className="w-4 h-4 opacity-90" />
                    </a>
                    <ZoomIn className="w-4 h-4 opacity-75" />
                  </div>
                )}
              </div>
            )}
            {message.text && <p className="text-xs sm:text-sm mb-1 leading-relaxed">{message.text}</p>}
            <div className={`flex items-center justify-end gap-1 text-[10.5px] font-mono opacity-85 mt-1`}>
              <span>{message.timestamp}</span>
              {isAgent && <MessageStatusTicks status={message.deliveryStatus} />}
            </div>
            {isAgent && message.deliveryStatus === 'failed' && <FailedSendNotice onRetry={onRetry} />}
          </div>
        </div>

        {/* Lightbox Visualizador de Mídias e Pedidos Médicos */}
        <Dialog open={isLightboxOpen && hasRealFile} onOpenChange={(open) => !open && setIsLightboxOpen(false)}>
          <DialogContent className="max-w-2xl rounded-3xl p-6" showCloseButton={false}>
            <DialogClose
              aria-label="Fechar"
              render={<button className="absolute top-2 right-2 size-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" />}
            >
              <X className="w-5 h-5" />
            </DialogClose>
            <DialogHeader>
              <DialogTitle className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                {fileName}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Preview Container */}
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={message.mediaUrl} alt={fileName} className="max-h-[60vh] w-full rounded-2xl object-contain" />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                  <ImageIcon className="w-16 h-16 text-teal-500" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{fileName}</p>
                  {fileSize && <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{fileSize}</span>}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                {!isImage && (
                  // Sem o atributo "download": deixa o navegador abrir o PDF no
                  // visualizador nativo dele em vez de forçar baixar o arquivo
                  // (o "download" é ignorado de formas inconsistentes em URL
                  // cross-origin — em vários navegadores/celulares simplesmente
                  // não abria nada, então o botão de baixar era a única opção).
                  <a
                    href={message.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl shadow-2xs"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Abrir Documento</span>
                  </a>
                )}
                <a
                  href={message.mediaUrl}
                  download={fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-2xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Arquivo</span>
                </a>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // 4. Balão de Texto Padrão (Recebido / Enviado)
  return (
    <div
      className={`flex w-full mb-3 group animate-in fade-in slide-in-from-bottom-1 duration-150 ${isAgent ? 'justify-end' : 'justify-start'}`}
      data-od-id={`chat-msg-${message.id}`}
    >
      <div
        className={`relative max-w-[85%] sm:max-w-md md:max-w-lg rounded-2xl p-3.5 shadow-sm text-sm leading-relaxed transition-all ${
          isAgent
            ? 'bg-emerald-600 dark:bg-emerald-700 text-white rounded-tr-xs hover:bg-emerald-600/95 dark:hover:bg-emerald-700/95'
            : 'bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-xs hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <p
          className={`whitespace-pre-wrap font-sans text-xs sm:text-[13.5px] leading-relaxed select-text ${
            message.deleted ? `italic line-through ${isAgent ? 'text-rose-100' : 'text-rose-500 dark:text-rose-400'}` : ''
          }`}
        >
          {message.text}
        </p>
        <div
          className={`flex items-center justify-end gap-1.5 text-[10px] font-mono mt-1 ${
            isAgent ? 'text-emerald-100/90' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span>{message.timestamp}</span>
          {isAgent && <MessageStatusTicks status={message.deliveryStatus} />}
        </div>
        {isAgent && message.deliveryStatus === 'failed' && <FailedSendNotice onRetry={onRetry} />}
      </div>
    </div>
  );
};
