"use client";

import React, { useState } from 'react';
import { Message } from '@/types/chat-crm';
import { Play, Pause, Lock, CheckCheck, FileText, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Texto copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. Nota Interna Privada
  if (message.type === 'internal_note') {
    return (
      <div className="flex justify-center my-3.5 w-full px-2 sm:px-4 animate-in fade-in slide-in-from-bottom-2 duration-200" data-od-id={`internal-note-${message.id}`}>
        <div className="max-w-xl w-full bg-amber-50/95 border border-amber-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs text-amber-950 text-xs sm:text-sm space-y-2 relative group">
          <div className="flex items-center justify-between pb-2 border-b border-amber-200/70">
            <span className="inline-flex items-center gap-1.5 font-bold text-[11px] text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
              <Lock className="w-3 h-3 text-amber-700" />
              Nota Privada (Equipe)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => message.text && handleCopyText(message.text)}
                className="opacity-0 group-hover:opacity-100 p-1 text-amber-700 hover:text-amber-900 transition-opacity rounded"
                title="Copiar nota"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <span className="text-[11px] text-amber-700/80 font-mono font-medium">{message.timestamp}</span>
            </div>
          </div>
          <p className="leading-relaxed text-amber-950 font-sans text-xs sm:text-sm whitespace-pre-wrap">{message.text}</p>
          {message.senderName && (
            <div className="pt-1 text-[11px] text-amber-800/80 flex items-center justify-end font-semibold font-mono">
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
              ? 'bg-emerald-600 text-white rounded-tr-xs'
              : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 shrink-0 shadow-2xs ${
                isAgent
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
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
                          : active ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                      style={{ height: `${Math.max(16, height * 0.28)}px` }}
                    />
                  );
                })}
              </div>

              <div className="flex justify-between items-center text-[10.5px] opacity-85 font-mono">
                <span>{message.audioDuration || '0:34'}</span>
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

  // 3. Balão de Anexo
  if (message.type === 'attachment') {
    return (
      <div
        className={`flex w-full mb-3 animate-in fade-in slide-in-from-bottom-1 duration-150 ${isAgent ? 'justify-end' : 'justify-start'}`}
        data-od-id={`attachment-msg-${message.id}`}
      >
        <div
          className={`max-w-md rounded-2xl p-3.5 shadow-2xs ${
            isAgent
              ? 'bg-emerald-600 text-white rounded-tr-xs'
              : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/5 mb-2 border border-black/5">
            <div className={`p-2 rounded-lg ${isAgent ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{message.attachmentName || 'documento.pdf'}</p>
              <p className="text-[10px] opacity-80 font-mono">{message.attachmentSize || '1.4 MB'}</p>
            </div>
          </div>
          {message.text && <p className="text-xs sm:text-sm mb-1 leading-relaxed">{message.text}</p>}
          <div className={`flex items-center justify-end gap-1 text-[10.5px] font-mono opacity-85 mt-1`}>
            <span>{message.timestamp}</span>
            {isAgent && <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />}
          </div>
        </div>
      </div>
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
            ? 'bg-emerald-600 text-white rounded-tr-xs hover:bg-emerald-600/95'
            : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs hover:border-slate-300'
        }`}
      >
        <p className="whitespace-pre-wrap font-sans text-xs sm:text-[13.5px] leading-relaxed select-text">{message.text}</p>
        <div
          className={`flex items-center justify-end gap-1.5 text-[10px] font-mono mt-1 ${
            isAgent ? 'text-emerald-100/90' : 'text-slate-400'
          }`}
        >
          <span>{message.timestamp}</span>
          {isAgent && <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />}
        </div>
      </div>
    </div>
  );
};

