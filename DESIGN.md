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

## 5. Visual "vidro" (09/11/2026) — Relatório e Ficha do paciente
Nasceu no piloto do Relatório e foi aplicado à ficha do paciente. É a direção para as
próximas telas redesenhadas; as demais seguem as seções 1–4 até serem migradas.

- **Fundo da tela**: envolver a página em `.soft-canvas` (globals.css) — claro #f3f6fa com
  manchas suaves azul/menta/lilás; escuro #0c0d11 com brilhos esmeralda/céu/índigo.
  Dentro dele, os `Select` viram pílulas de vidro automaticamente.
- **Cartão de vidro**: `.glass-surface p-5` (raio 1.75rem, branco 74% + blur 22px, sombra
  suave; escuro rgb(26 27 33/.66)). Substitui `rounded-2xl bg-white shadow-xs` nessas telas.
  Pílula de vidro: `glass-surface !rounded-full`.
- **Painel interno**: `.glass-well` (raio 1.25rem, slate claro 70% / branco 5% no escuro)
  para linhas de lista ou blocos dentro de um cartão de vidro.
- **KPI em pílula** (`KpiPill`, src/components/clinic/report-hero.tsx): selo redondo com
  ícone + valor + rótulo + variação (`ReportDelta variant="chip"`).
- **Cartão de destaque** (`HighlightTile`, mesmo arquivo): tons `blue | teal | ink | sun`,
  título, valor grande (`text-[1.375rem] sm:text-[2rem]`), linha de apoio e botão redondo
  com seta no canto (`href` vira Link; `onOpen` vira botão — ex.: abrir uma aba).
  No celular ficam em `grid-cols-2`; no desktop até 4 por linha.
- **Abas em pílula**: trilho sem barra de rolagem visível
  (`overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`); ativa
  `bg-slate-900 text-white dark:bg-white dark:text-slate-900`, demais sem fundo.
- **Ações rápidas** (`QuickAction`, patient-page.tsx): círculo `size-11` com o nome embaixo
  (`text-[11px]`), todas numa linha; a principal (Conversa) em verde cheio.
- **Pílula de contexto** (`ContextPill`) e **linha de dado** (`InfoRow`: ícone redondo
  `size-8`, rótulo `text-xs` em cima, valor embaixo; vazio = "—" em cinza claro).
- **Layout da ficha**: desktop `lg:grid-cols-[minmax(0,1fr)_22rem]` com perfil e dados à
  direita; no celular a ordem é perfil → destaques e histórico → dados cadastrais (usar
  `lg:col-start/row-start` em vez de `order` para manter a ordem do DOM certa no celular).
- Lembrete Tailwind 3: importante é `!classe` (prefixo), não `classe!`.
