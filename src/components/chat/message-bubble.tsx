"use client";

import React, { useState } from 'react';
import { Message } from '@/types/chat-crm';
import { Play, Pause, Lock, CheckCheck, FileText } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // 1. Nota Interna Privada
  if (message.type === 'internal_note') {
    return (
      <div className="flex justify-center my-3 w-full px-4" data-od-id={`internal-note-${message.id}`}>
        <div className="max-w-xl w-full bg-amber-50/90 border border-amber-200/90 rounded-xl p-3.5 shadow-sm text-amber-950 text-sm">
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-amber-200/60">
            <span className="inline-flex items-center gap-1.5 font-medium text-xs text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
              <Lock className="w-3 h-3" />
              Nota da Equipe (O paciente não vê)
            </span>
            <span className="text-[11px] text-amber-700/80 font-mono">{message.timestamp}</span>
          </div>
          <p className="leading-relaxed text-amber-900 font-sans text-xs sm:text-sm">{message.text}</p>
          {message.senderName && (
            <div className="mt-2 text-[11px] text-amber-700/75 flex items-center justify-end font-medium">
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
        className={`flex w-full mb-3 ${isAgent ? 'justify-end' : 'justify-start'}`}
        data-od-id={`audio-msg-${message.id}`}
      >
        <div
          className={`max-w-md w-72 sm:w-80 rounded-2xl p-3.5 shadow-sm ${
            isAgent
              ? 'bg-emerald-600 text-white rounded-tr-xs'
              : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-xs'
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                isAgent
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
              }`}
              title={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <div className="flex-1 flex flex-col justify-center gap-1.5">
              <div className="flex items-center gap-1 h-7">
                {waveform.map((height, idx) => {
                  const active = idx < (waveform.length * 0.4);
                  return (
                    <div
                      key={idx}
                      className={`w-1 rounded-full transition-all duration-300 ${
                        isAgent
                          ? active ? 'bg-white' : 'bg-emerald-400/60'
                          : active ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                      style={{ height: `${Math.max(20, height * 0.28)}px` }}
                    />
                  );
                })}
              </div>

              <div className="flex justify-between items-center text-[11px] opacity-80 font-mono">
                <span>{message.audioDuration || '0:34'}</span>
                <span className="flex items-center gap-1">
                  {message.timestamp}
                  {isAgent && <CheckCheck className="w-3.5 h-3.5" />}
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
        className={`flex w-full mb-3 ${isAgent ? 'justify-end' : 'justify-start'}`}
        data-od-id={`attachment-msg-${message.id}`}
      >
        <div
          className={`max-w-md rounded-2xl p-3.5 shadow-sm ${
            isAgent
              ? 'bg-emerald-600 text-white rounded-tr-xs'
              : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-xs'
          }`}
        >
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/5 mb-2">
            <div className={`p-2 rounded-lg ${isAgent ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{message.attachmentName || 'documento.pdf'}</p>
              <p className="text-[10px] opacity-75 font-mono">{message.attachmentSize || '1.4 MB'}</p>
            </div>
          </div>
          {message.text && <p className="text-xs sm:text-sm mb-1">{message.text}</p>}
          <div className={`flex items-center justify-end gap-1 text-[10px] font-mono opacity-80 mt-1`}>
            <span>{message.timestamp}</span>
            {isAgent && <CheckCheck className="w-3.5 h-3.5" />}
          </div>
        </div>
      </div>
    );
  }

  // 4. Balão de Texto Padrão (Recebido / Enviado)
  return (
    <div
      className={`flex w-full mb-3 ${isAgent ? 'justify-end' : 'justify-start'}`}
      data-od-id={`chat-msg-${message.id}`}
    >
      <div
        className={`max-w-[82%] sm:max-w-md md:max-w-lg rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed ${
          isAgent
            ? 'bg-emerald-600 text-white rounded-tr-xs'
            : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-xs'
        }`}
      >
        <p className="whitespace-pre-wrap font-sans text-xs sm:text-[13.5px] leading-relaxed">{message.text}</p>
        <div
          className={`flex items-center justify-end gap-1 text-[10.5px] font-mono mt-1 ${
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
