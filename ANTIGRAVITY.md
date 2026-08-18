# Conecta Saúde — Diretrizes Globais para o Antigravity

Este arquivo define as regras de arquitetura, documentação, navegação de código e padrões visuais do projeto.

---

## 1. Visão Geral e Stack Técnica
- **Projeto:** Conecta Saúde — Plataforma de agendamento e encaminhamento de consultas e exames particulares.
- **Domínio Oficial de Produção:** `https://conectasaudevc.com.br`
- **Stack:** Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui, Prisma ORM, PostgreSQL no Supabase e NextAuth v4.

---

## 2. Documentação e Sincronização com o Obsidian
- **Pasta de Documentação no Repositório:** `docs/obsidian/`
- **Caminho do Obsidian Vault Local:** `C:\Users\lucas\Documents\TIVDC\obsidian-vault\Projetos\Sistema-Agendamento\`
- **Regra de Espelhamento:** Sempre que criar, editar ou atualizar qualquer nota técnica em `docs/obsidian/`, crie/atualize a cópia correspondente na pasta do Obsidian Vault acima.
- **Padrão de Links:** Utilize links internos no formato `[[Nome da Nota]]` e mantenha o índice principal atualizado em `[[00 - Visão Geral]]`.

---

## 3. Grafo de Conhecimento (Graphify)
- **Mapa de Dependências:** Consulte os arquivos `graphify-out/GRAPH_REPORT.md` e `graphify-out/graph.json` para entender conexões entre componentes, rotas e tabelas antes de grandes refatorações.
- **Atualização do Grafo:** Após a criação de novas funcionalidades ou módulos completos, execute `graphify .` no terminal integrado para manter o mapa atualizado.

---

## 4. Padrões de Design e UI/UX (Impeccable)
- **Diretrizes Oficiais:** Siga rigorosamente as regras de estilo documentadas em `DESIGN.md` e `PRODUCT.md`.
- **Boas Práticas de UI:**
  - Evite gradientes decorativos em texto (`bg-clip-text`); dê destaque por peso (`font-bold`/`font-extrabold`) ou cor sólida de marca (`text-teal-600`).
  - Mantenha contraste de cores acessível (mínimo 3:1 para títulos e 4.5:1 para textos corridos).
  - Garanta responsividade completa para dispositivos móveis (smartphones) com suporte a navegação por gaveta (*drawer*), botões de voltar e espaçamentos adaptativos.
  - Para auditar ou polir componentes, utilize as diretrizes do `Impeccable` (`/impeccable audit` e `/impeccable polish`).

---

## 5. Fluxo de Validação e Deploy
- Antes de realizar commits, execute a validação de tipos (`npx tsc --noEmit`) e teste o build de produção (`npm run build`).
- Utilize mensagens de commit semânticas (ex: `feat:`, `fix:`, `style:`, `refactor:`, `docs:`).
- Faça o `git push origin main` para disparar o deploy automático na Vercel.