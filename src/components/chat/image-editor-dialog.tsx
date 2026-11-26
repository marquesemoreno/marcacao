'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crop, Pencil, RotateCw, Send, Type, Undo2, X } from 'lucide-react';

/** Editar a foto antes de enviar, como no WhatsApp Web: girar, recortar, desenhar e
 * escrever. Tudo no navegador (canvas); o que sai é um JPG novo. GIF e PDF não passam aqui. */

type Mode = 'none' | 'crop' | 'draw' | 'text';
type Rect = { x: number; y: number; w: number; h: number };

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ffffff', '#000000'];
const MAX_SIDE = 2560;

export function isEditableImage(file: File): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}

export function ImageEditorDialog({
  file,
  remaining,
  onSend,
  onCancel,
}: {
  file: File;
  /** Quantas fotos ainda esperam depois desta. */
  remaining: number;
  onSend: (file: File) => Promise<void> | void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<ImageData[]>([]);
  const drawingRef = useRef<{ x: number; y: number } | null>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [edited, setEdited] = useState(false);
  const [mode, setMode] = useState<Mode>('none');
  const [color, setColor] = useState(COLORS[0]);
  const [text, setText] = useState('');
  const [crop, setCrop] = useState<Rect | null>(null);
  const [sending, setSending] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  // Carrega a foto no canvas (reduz fotos enormes para não travar o navegador).
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const c = canvasRef.current;
      if (!c) return;
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      historyRef.current = [];
      setCanUndo(false);
      setEdited(false);
      setMode('none');
      setCrop(null);
      setReady(true);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    setReady(false);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const ctx = () => canvasRef.current!.getContext('2d')!;

  const snapshot = useCallback(() => {
    const c = canvasRef.current!;
    historyRef.current.push(ctx().getImageData(0, 0, c.width, c.height));
    if (historyRef.current.length > 30) historyRef.current.shift();
    setCanUndo(true);
    setEdited(true);
  }, []);

  const undo = () => {
    const last = historyRef.current.pop();
    if (!last) return;
    const c = canvasRef.current!;
    c.width = last.width;
    c.height = last.height;
    ctx().putImageData(last, 0, 0);
    setCanUndo(historyRef.current.length > 0);
    setCrop(null);
  };

  /** Ponto do mouse em coordenadas da imagem (o canvas aparece reduzido na tela). */
  const point = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const lineWidth = () => Math.max(3, Math.round(Math.max(canvasRef.current!.width, canvasRef.current!.height) / 120));

  const rotate = () => {
    snapshot();
    const c = canvasRef.current!;
    const tmp = document.createElement('canvas');
    tmp.width = c.height;
    tmp.height = c.width;
    const t = tmp.getContext('2d')!;
    t.translate(tmp.width, 0);
    t.rotate(Math.PI / 2);
    t.drawImage(c, 0, 0);
    c.width = tmp.width;
    c.height = tmp.height;
    ctx().drawImage(tmp, 0, 0);
    setCrop(null);
  };

  const applyCrop = () => {
    if (!crop || crop.w < 10 || crop.h < 10) return;
    snapshot();
    const c = canvasRef.current!;
    const data = ctx().getImageData(Math.round(crop.x), Math.round(crop.y), Math.round(crop.w), Math.round(crop.h));
    c.width = data.width;
    c.height = data.height;
    ctx().putImageData(data, 0, 0);
    setCrop(null);
    setMode('none');
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    const p = point(e);
    if (mode === 'draw') {
      e.currentTarget.setPointerCapture(e.pointerId);
      snapshot();
      drawingRef.current = p;
      const g = ctx();
      g.fillStyle = color;
      g.beginPath();
      g.arc(p.x, p.y, lineWidth() / 2, 0, Math.PI * 2);
      g.fill();
    } else if (mode === 'crop') {
      e.currentTarget.setPointerCapture(e.pointerId);
      cropStartRef.current = p;
      setCrop({ x: p.x, y: p.y, w: 0, h: 0 });
    } else if (mode === 'text' && text.trim()) {
      snapshot();
      const g = ctx();
      const size = Math.max(20, Math.round(Math.max(canvasRef.current!.width, canvasRef.current!.height) / 12));
      g.font = `bold ${size}px system-ui, sans-serif`;
      g.textBaseline = 'middle';
      g.textAlign = 'center';
      g.lineWidth = Math.max(2, size / 8);
      g.strokeStyle = color === '#000000' ? '#ffffff' : '#000000';
      g.strokeText(text.trim(), p.x, p.y);
      g.fillStyle = color;
      g.fillText(text.trim(), p.x, p.y);
      setText('');
      setMode('none');
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = point(e);
    if (mode === 'draw' && drawingRef.current) {
      const g = ctx();
      g.strokeStyle = color;
      g.lineWidth = lineWidth();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(drawingRef.current.x, drawingRef.current.y);
      g.lineTo(p.x, p.y);
      g.stroke();
      drawingRef.current = p;
    } else if (mode === 'crop' && cropStartRef.current) {
      const c = canvasRef.current!;
      const s = cropStartRef.current;
      const x = Math.max(0, Math.min(s.x, p.x));
      const y = Math.max(0, Math.min(s.y, p.y));
      setCrop({ x, y, w: Math.min(c.width, Math.max(s.x, p.x)) - x, h: Math.min(c.height, Math.max(s.y, p.y)) - y });
    }
  };

  const onPointerUp = () => {
    drawingRef.current = null;
    cropStartRef.current = null;
  };

  const send = async (useOriginal: boolean) => {
    if (sending) return;
    setSending(true);
    try {
      if (useOriginal || !edited) {
        await onSend(file);
        return;
      }
      const blob = await new Promise<Blob | null>((resolve) => canvasRef.current!.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) {
        await onSend(file);
        return;
      }
      const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
      await onSend(new File([blob], name, { type: 'image/jpeg' }));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const c = canvasRef.current;
  const toolBtn = (active: boolean) =>
    `inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
      active ? 'bg-emerald-600 text-white' : 'text-slate-200 hover:bg-white/10'
    }`;

  // Portal no body: o compositor fica dentro de painéis com backdrop-blur, e `fixed` dentro
  // deles fica preso ao painel em vez da tela.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/95" role="dialog" aria-modal="true" aria-label="Editar foto antes de enviar">
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-white/10">
        <button type="button" onClick={onCancel} className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-200 hover:bg-white/10" aria-label="Cancelar envio desta foto" title="Cancelar (Esc)">
          <X className="w-5 h-5" />
        </button>
        <span className="mr-2 text-sm text-slate-300 truncate max-w-[30ch]">{file.name}</span>
        <button type="button" className={toolBtn(mode === 'crop')} onClick={() => { setMode(mode === 'crop' ? 'none' : 'crop'); setCrop(null); }}>
          <Crop className="w-4 h-4" /> Recortar
        </button>
        <button type="button" className={toolBtn(false)} onClick={rotate} disabled={!ready}>
          <RotateCw className="w-4 h-4" /> Girar
        </button>
        <button type="button" className={toolBtn(mode === 'draw')} onClick={() => setMode(mode === 'draw' ? 'none' : 'draw')}>
          <Pencil className="w-4 h-4" /> Desenhar
        </button>
        <button type="button" className={toolBtn(mode === 'text')} onClick={() => setMode(mode === 'text' ? 'none' : 'text')}>
          <Type className="w-4 h-4" /> Texto
        </button>
        <button type="button" className={toolBtn(false) + ' disabled:opacity-40'} onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">
          <Undo2 className="w-4 h-4" /> Desfazer
        </button>
        {(mode === 'draw' || mode === 'text') && (
          <div className="flex items-center gap-1 ml-2" role="radiogroup" aria-label="Cor">
            {COLORS.map((c2) => (
              <button
                key={c2}
                type="button"
                role="radio"
                aria-checked={color === c2}
                aria-label={`Cor ${c2}`}
                onClick={() => setColor(c2)}
                className={`w-6 h-6 rounded-full border-2 ${color === c2 ? 'border-emerald-400 scale-110' : 'border-white/30'}`}
                style={{ backgroundColor: c2 }}
              />
            ))}
          </div>
        )}
      </div>

      {mode === 'text' && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 text-sm text-slate-200">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva o texto e clique na foto onde ele deve ficar"
            className="flex-1 max-w-md h-9 px-3 rounded-lg bg-white/10 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      )}
      {mode === 'crop' && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 text-sm text-slate-200">
          <span>Arraste sobre a foto para marcar a área.</span>
          <button type="button" onClick={applyCrop} disabled={!crop || crop.w < 10 || crop.h < 10} className="h-8 px-3 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-40">
            Aplicar recorte
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        <div className="relative max-w-full max-h-full">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`block max-w-full max-h-[calc(100vh-11rem)] object-contain touch-none ${mode === 'none' ? '' : 'cursor-crosshair'}`}
          />
          {crop && c && (
            <div
              className="absolute border-2 border-dashed border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none"
              style={{ left: `${(crop.x / c.width) * 100}%`, top: `${(crop.y / c.height) * 100}%`, width: `${(crop.w / c.width) * 100}%`, height: `${(crop.h / c.height) * 100}%` }}
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
        {remaining > 0 && <span className="mr-auto text-sm text-slate-400">Mais {remaining} foto(s) depois desta</span>}
        {edited && (
          <button type="button" onClick={() => send(true)} disabled={sending} className="h-10 px-4 rounded-full text-sm font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50">
            Enviar original
          </button>
        )}
        <button type="button" onClick={() => send(false)} disabled={sending || !ready} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50">
          <Send className="w-4 h-4" /> {sending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
