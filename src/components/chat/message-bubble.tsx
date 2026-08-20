"use client";

import React, { useState } from 'react';
import { Message } from '@/types/chat-crm';
import { Play, Pause, Lock, CheckCheck, FileText, Copy, Check, Download, ZoomIn, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<'1x' | '1.5x' | '2x'>('1x');
  const [copied, setCopied] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Texto copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  const cycleSpeed = () => {
    if (playbackSpeed === '1x') setPlaybackSpeed('1.5x');
    else if (playbackSpeed === '1.5x') setPlaybackSpeed('2x');
    else setPlaybackSpeed('1x');
  };

  // 1. Nota Interna Privada
  if (message.type === 'internal_note') {
    return (
      <div className="flex justify-center my-3.5 w-full px-2 sm:px-4 animate-in fade-in slide-in-from-bottom-2 duration-200" data-od-id={`internal-note-${message.id}`}>
        <div className="max-w-xl w-full bg-amber-50/95 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs text-amber-950 dark:text-amber-200 text-xs sm:text-sm space-y-2 relative group">
          <div className="flex items-center justify-between pb-2 border-b border-amber-200/70 dark:border-amber-800/60">
            <span className="inline-flex items-center gap-1.5 font-bold text-[11px] text-amber-800 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-900/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
              <Lock className="w-3 h-3 text-amber-700 dark:text-amber-400" />
              🔒 Nota Privada (Equipe)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => message.text && handleCopyText(message.text)}
                className="opacity-0 group-hover:opacity-100 p-1 text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-opacity rounded"
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

  // 2. Balão de Áudio
  if (message.type === 'audio') {
    const defaultWaveform = [30, 45, 80, 60, 40, 75, 90, 65, 35, 50, 70, 85, 40, 60, 95, 80, 55, 30, 45, 60];
    const waveform = message.audioWaveform || defaultWaveform;

    return (
      <div
        className={`flex w-full mb-3 animate-in fade-in slide-in-from-bottom-1 duration-150 ${isAgent ? 'justify-end' : 'justify-start'}`}
        data-od-id={`audio-msg-${message.id}`}
      >
        <div
          className={`max-w-md w-72 sm:w-80 rounded-2xl p-3 sm:p-3.5 shadow-2xs transition-all ${
            isAgent
              ? 'bg-emerald-600 dark:bg-emerald-700 text-white rounded-tr-xs'
              : 'bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-xs hover:border-slate-300 dark:hover:border-slate-600'
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 shrink-0 shadow-2xs ${
                isAgent
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-400'
              }`}
              title={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current animate-pulse" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <div className="flex-1 flex flex-col justify-center gap-1.5">
              <div className="flex items-center gap-1 h-7">
                {waveform.map((height, idx) => {
                  const active = isPlaying ? idx < (waveform.length * 0.7) : idx < (waveform.length * 0.3);
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
                  <span>{message.audioDuration || '0:34'}</span>
                  {/* Seletor de Velocidade */}
                  <button
                    onClick={cycleSpeed}
                    className={`px-1.5 py-0.5 rounded font-mono font-extrabold text-[10px] transition-colors ${
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
                  {isAgent && <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />}
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
    return (
      <>
        <div
          className={`flex w-full mb-3 animate-in fade-in slide-in-from-bottom-1 duration-150 ${isAgent ? 'justify-end' : 'justify-start'}`}
          data-od-id={`attachment-msg-${message.id}`}
        >
          <div
            className={`max-w-md rounded-2xl p-3.5 shadow-2xs cursor-pointer transition-all ${
              isAgent
                ? 'bg-emerald-600 dark:bg-emerald-700 text-white rounded-tr-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-xs hover:border-slate-300 dark:hover:border-slate-600'
            }`}
            onClick={() => setIsLightboxOpen(true)}
          >
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 mb-2 border border-black/5 dark:border-white/10 hover:bg-black/10 transition-colors">
              <div className={`p-2 rounded-lg ${isAgent ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{message.attachmentName || 'documento_pedido.pdf'}</p>
                <p className="text-[10px] opacity-80 font-mono">{message.attachmentSize || '1.4 MB'}</p>
              </div>
              <ZoomIn className="w-4 h-4 opacity-75 shrink-0" />
            </div>
            {message.text && <p className="text-xs sm:text-sm mb-1 leading-relaxed">{message.text}</p>}
            <div className={`flex items-center justify-end gap-1 text-[10.5px] font-mono opacity-85 mt-1`}>
              <span>{message.timestamp}</span>
              {isAgent && <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />}
            </div>
          </div>
        </div>

        {/* Lightbox Visualizador de Mídias e Pedidos Médicos */}
        {isLightboxOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{message.attachmentName || 'Documento / Pedido Médico'}</h3>
                </div>
                <button
                  onClick={() => setIsLightboxOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Preview Container */}
              <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <ImageIcon className="w-16 h-16 text-teal-500" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{message.attachmentName || 'arquivo_anexo.pdf'}</p>
                <span className="text-[11px] text-slate-400 font-mono">{message.attachmentSize || '1.4 MB'}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    toast.success('Download iniciado!');
                    setIsLightboxOpen(false);
                  }}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-2xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Arquivo</span>
                </button>
              </div>
            </div>
          </div>
        )}
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
        className={`relative max-w-[85%] sm:max-w-md md:max-w-lg rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 shadow-2xs text-sm leading-relaxed transition-all ${
          isAgent
            ? 'bg-emerald-600 dark:bg-emerald-700 text-white rounded-tr-xs hover:bg-emerald-600/95 dark:hover:bg-emerald-700/95'
            : 'bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-xs hover:border-slate-300 dark:hover:border-slate-600'
        }`}
      >
        <p className="whitespace-pre-wrap font-sans text-xs sm:text-[13.5px] leading-relaxed select-text">{message.text}</p>
        <div
          className={`flex items-center justify-end gap-1.5 text-[10px] font-mono mt-1 ${
            isAgent ? 'text-emerald-100/90' : 'text-slate-400 dark:text-slate-400'
          }`}
        >
          <span>{message.timestamp}</span>
          {isAgent && <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />}
        </div>
      </div>
    </div>
  );
};
