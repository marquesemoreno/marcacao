# Conecta Saúde - Design System Guidelines (SaaS Clean / Shadcn UI)

## 1. Princípios de Design
- Densidade visual equilibrada: compacta para recepcionistas verem mais dados sem scroll excessivo.
- Sem cantos estilo "pílula" em formulários corporativos. Use cantos sutis (`rounded-lg` / 8px).
- Evitar caixas de texto com rótulos em UPPERCASE. Usar `text-xs font-medium text-slate-600`.

## 2. Paleta de Cores (Tailwind CSS)
- Fundo da Aplicação: `bg-slate-50` / `bg-slate-100/50`
- Cards e Superfícies: `bg-white border border-slate-200 shadow-xs`
- Cor Primária da Marca (Esmeralda Clínico): `bg-emerald-600 hover:bg-emerald-700 text-white`
- Acentos Sutis: `bg-emerald-50 text-emerald-700 border-emerald-200`
- Texto Principal: `text-slate-900`
- Texto Secundário: `text-slate-500`
- Divisórias e Linhas: `border-slate-200`

## 3. Tipografia e Escala
- Títulos de Página: `text-xl md:text-2xl font-semibold tracking-tight text-slate-900`
- Cabeçalhos de Seção / Cards: `text-sm font-semibold text-slate-800`
- Corpo e Tabela: `text-sm text-slate-600`
- Metadados, Horários e Subtextos: `text-xs text-slate-400`

## 4. Componentes e Formulários
- Inputs e Selects: `h-9 px-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`
- Modais: Layout sempre em grid de 2 colunas no desktop (`md:grid-cols-2 gap-4`), sem scroll vertical interno desnecessário.
- Badges / Chips: `text-xs px-2.5 py-0.5 rounded-full font-medium border`