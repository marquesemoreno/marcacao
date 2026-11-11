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
  O `emerald-600` é remapeado em `tailwind.config.ts` para `#04865e` (11/11/2026): com texto
  branco dá contraste 4,6:1; o padrão do Tailwind (`#059669`) dava 3,8:1.
- Tamanho mínimo de texto: `text-xs` (12 px). Não usar `text-[10px]`/`text-[11px]`; a única
  exceção é o rótulo das ações rápidas da ficha (§5).
  Acento suave: `bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300`.
- Texto: principal `text-slate-900`, secundário `text-slate-500`.
  O `slate-500` muda com o tema (variável `--slate-500` em `globals.css`, 11/11/2026): `#707075`
  no claro (4,9:1 sobre branco) e `#86868b` no escuro. Em superfície sempre escura (menu
  lateral, TV) usar `text-slate-400`, que não muda. `text-slate-400` sobre fundo claro é só
  para ícone, nunca para texto que precisa ser lido.
- Texto de exemplo dos campos (placeholder): cor única por tema, variável `--placeholder` em
  `globals.css` (`#707075` no claro, `#aeaeb2` no escuro). Não pôr `placeholder:text-slate-*`
  no campo. `--muted-foreground` no claro é `oklch(0.5 0 0)` (abas inativas acima de 5:1).

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

## 5. Visual "vidro" (09/11/2026) — todas as telas da clínica
Nasceu no piloto do Relatório e foi aplicado, em 09/11, a todas as telas da clínica:
Relatório, Ficha, Agenda, CRM, Disparos, Pacientes, Marcadores, Configurações, IA, Senhas e
Chat. É o padrão para telas novas. As seções 1–4 continuam valendo para o que não for
superfície (tipografia, cores de status, botões, formulários em gaveta/diálogo).

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

### 5.1 Padrões repetidos nas telas migradas
- **Pílula de filtro/botão** (PILL): `bg-white/80 ring-1 ring-slate-900/5 shadow-xs
  dark:bg-white/[0.08] dark:ring-white/10` (+ hover `bg-white` / `white/[0.14]`).
- **Ativo** (aba, chip, segmento): `bg-slate-900 text-white dark:bg-white dark:text-slate-900`.
- **Trilho de abas** (RAIL): `glass-surface !rounded-full p-1`; dentro de um cartão use
  `bg-slate-900/5 dark:bg-white/[0.06] rounded-full p-1`.
- **Linhas divisórias** (LINE): `border-slate-900/[0.07] dark:border-white/[0.07]`; listas
  `divide-slate-900/[0.05] dark:divide-white/[0.06]`.
- **Listas**: `<ul className="glass-surface overflow-hidden divide-y …">`, linhas com hover
  `bg-white/60 dark:bg-white/[0.04]`. Vazio: `glass-surface border border-dashed`.
- **Card do shadcn** dentro de `.soft-canvas` vira vidro sozinho (regra
  `.soft-canvas [data-slot="card"]` em globals.css, `--card-spacing: 1.25rem`) — não precisa
  trocar classes em Configurações/admin. `ui/card.tsx` usa sintaxe Tailwind 3
  (`px-[var(--card-spacing)]`).
- **Cor por item** (lista de pessoas): `avatarTone(nome)` em src/lib/avatar-tone.ts (8
  gradientes, hash estável) e `AvatarBadge fallbackClassName`; foto do WhatsApp quando já
  guardada no contato. Etapa do funil com as cores do CRM (Novo âmbar, Em atendimento céu,
  Orçamento violeta, Agendado esmeralda, Finalizado cinza). `tailwind.config.ts` varre
  `src/lib` por causa disso.
- **Painel de destaque** (Senhas "Chamando agora", perfil da Ficha): `glass-surface relative
  overflow-hidden` com 1–2 manchas `blur-3xl` (esmeralda/céu, 15–30%) atrás do conteúdo.
- **Chat**: fila, conversa e painel do paciente são painéis flutuantes (`md:glass-surface`,
  `md:gap-3 md:p-3`); no celular ocupam a tela inteira sem vidro. Cabeçalho e caixa de
  mensagem `bg-white/70 dark:bg-white/[0.03] backdrop-blur-xl`; conversa selecionada vira
  cartão claro. **Balões continuam sólidos** (leitura do dia inteiro) — não aplicar vidro.
- **Painel do paciente (Chat)**: cartões internos `bg-white/80 dark:bg-white/[0.05]
  rounded-[1.25rem] ring-1` com título `text-sm font-semibold` curto e numa linha só
  (painel tem 320px — ex.: "Copiloto", não "Copilot — sugestões de resposta"). Dentro
  deles: itens em poço suave `rounded-2xl bg-slate-900/[0.04] dark:bg-white/[0.04]`
  (sugestões do Copiloto, consultas do Histórico), selos de status/tags em `rounded-full`,
  campos de edição `rounded-xl` (ou `rounded-full` em linha única) com borda leve e foco
  verde, botões e seletor de atendente em pílula, etapas do atendimento em pílula (ativa
  verde cheio). Aviso de confirmação em âmbar `rounded-2xl`.
- **Não migrar** gavetas (Sheet) e diálogos de formulário: continuam sólidos, com bordas
  nos campos, para leitura e foco.
- **Celular**: sempre conferir `scrollWidth == innerWidth`; abas longas rolam na horizontal
  (`!flex-nowrap` + itens `!flex-none`), textos secundários de botão somem com
  `max-sm:sr-only`.
- **Testar** pela prévia Vercel (push para um branch `design/*`), claro, escuro e celular.
