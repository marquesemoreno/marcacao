# Conecta Saúde - Design System Guidelines (estilo Apple, nov/2026)

A partir de 06/11/2026 o painel segue um visual inspirado na Apple (iOS/macOS):
superfícies limpas, cantos arredondados, quase nenhuma borda, cinzas neutros.

## 1. Princípios
- Densidade equilibrada: a recepção precisa ver muitos dados sem rolar demais — o
  estilo Apple aqui é sobre limpeza, não sobre espaço vazio.
- Separar por **fundo**, não por borda: cartão branco sobre fundo cinza (`slate-100`),
  como nos Ajustes do iPhone. Borda só quando carrega significado (pendente tracejado,
  alerta âmbar, foco).
- Uma ação principal por área em verde cheio; as demais em tom suave ou cinza.
- Evitar rótulos em UPPERCASE. Usar `text-xs font-medium text-slate-600`.

## 2. Cores
- `slate-*` é remapeado em `tailwind.config.ts` para os cinzas da Apple
  (50 #fbfbfd, 100 #f5f5f7, 200 #e8e8ed, 300 #d2d2d7, 500 #86868b, 900 #1d1d1f…).
  Não usar `gray-*`/`zinc-*`.
- Fundo de área: `bg-slate-100 dark:bg-slate-950`. Cartão: `bg-white dark:bg-slate-900`.
- Marca (verde): `bg-emerald-600 hover:bg-emerald-700 text-white`.
  Acento suave: `bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300`.
- Texto: principal `text-slate-900`, secundário `text-slate-500`.

## 3. Tipografia
- Fonte Inter (fallback -apple-system), `letter-spacing: -0.011em` no body.
- Título de página: `text-xl md:text-2xl font-semibold tracking-tight`.
- Título de cartão: `text-sm font-semibold text-slate-800`.
- Corpo/tabela: `text-sm text-slate-600`. Metadados: `text-xs text-slate-500`.

## 4. Componentes
- **Cartão**: `rounded-2xl bg-white dark:bg-slate-900 shadow-xs` (sem `border`).
  Cartão clicável dentro de lista: `rounded-xl … hover:shadow-md`.
- **Botão principal**: `rounded-full bg-emerald-600 text-white px-4 h-9`.
  **Secundário**: `rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200`.
- **Controle segmentado** (abas/visões): trilho `inline-flex rounded-full bg-slate-100
  dark:bg-slate-800 p-0.5`; item ativo `rounded-full bg-white dark:bg-slate-700 shadow-sm`.
- **Busca / campo de filtro**: `rounded-full bg-slate-100 dark:bg-slate-800 border-transparent`.
- **Inputs de formulário**: `h-9 rounded-lg border border-slate-200` (formulário mantém borda
  para leitura clara do campo).
- **Chips/etiquetas e contadores**: `rounded-full`.
- **Lista (Chat)**: linhas `rounded-xl` sem divisória; selecionada = fundo `slate-200/70`.
- **Balões**: sem borda; enviado `bg-[#dff5ec]`, recebido branco; canto de cauda
  `rounded-br-md` / `rounded-bl-md`.
- **Modais**: grid de 2 colunas no desktop (`md:grid-cols-2 gap-4`), sem scroll interno
  desnecessário.
