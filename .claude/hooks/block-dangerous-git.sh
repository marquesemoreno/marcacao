#!/bin/bash
# Trava de git (adaptada de mattpocock/skills git-guardrails-claude-code, 09/11/2026).
# Diferente do original: push normal é LIBERADO (o usuário pré-autorizou commit+push na main);
# bloqueia só o que apaga trabalho ou reescreve histórico. Não usa jq (não instalado):
# procura no JSON bruto da chamada; [^;&|]* mantém o padrão dentro do mesmo comando.
INPUT=$(cat)

DANGEROUS_PATTERNS=(
  'git push[^;&|]*(--force|--force-with-lease|[[:space:]]-f([[:space:]]|"|$))'
  'git push[^;&|]*[[:space:]]\+[^[:space:]]'
  'git push[^;&|]*--delete'
  'git reset[^;&|]*--hard'
  'git clean[^;&|]*[[:space:]]-[a-zA-Z]*f'
  'git branch[^;&|]*[[:space:]]-D'
  'git checkout[^;&|]*[[:space:]](--[[:space:]]+)?\.([[:space:]]|"|$)'
  'git restore[^;&|]*[[:space:]]\.([[:space:]]|"|$)'
  'git stash[[:space:]]+(drop|clear)'
  'git filter-branch'
  'git rebase'
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if printf '%s' "$INPUT" | grep -qE "$pattern"; then
    echo "BLOCKED: comando de git destrutivo (padrão '$pattern'). Peça ao usuário para rodar ele mesmo se for mesmo necessário." >&2
    exit 2
  fi
done
exit 0
