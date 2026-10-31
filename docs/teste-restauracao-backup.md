# Teste de restauração do backup

Objetivo: provar que o backup do Supabase **volta inteiro e utilizável**, sem nunca tocar
em produção. Fazer a cada 3 meses (próximo: fev/2027) e sempre depois de mudança grande de banco.

> ⚠️ Em 27/09/2026 produção foi apagada e só voltou pelo backup. Este teste é para não
> descobrir na hora do incidente que o backup não serve.

## Regras

- **Nunca** use "Restore" no projeto de produção — isso SOBRESCREVE produção.
- Restaure sempre em um **projeto novo**.
- O projeto restaurado tem dados de pacientes: **apague-o no fim do teste** (LGPD).

## Passo a passo

### 1. Restaurar em um projeto novo (Supabase)
1. Supabase → projeto de produção → **Database → Backups**.
2. Escolha o backup diário mais recente → **Restore to a new project**.
   - Nome: `teste-restauracao-AAAA-MM`, mesma região.
   - Se essa opção não aparecer no plano: baixe o backup (**Download**) e me avise —
     restauramos num projeto gratuito novo via Docker.
3. Espere terminar (alguns minutos) e anote **quanto tempo levou** — é o tempo que a
   clínica ficaria sem sistema num incidente.

### 2. Conferir os dados (automático)
1. No projeto restaurado: **Connect → Session pooler** → copie a connection string
   (com a senha do projeto novo).
2. No `.env` local, adicione a linha:
   `RESTORE_TEST_URL="postgresql://...projeto-restaurado..."`
3. Rode:

```bash
npx tsx scripts/compare-restored-db.ts
```

O script só **lê** os dois bancos e mostra, tabela por tabela, linhas em produção ×
restaurado e o registro mais novo. Esperado:
- nenhuma tabela "FALTA NO RESTAURADO" ou "VAZIA";
- contagens iguais ou um pouco menores (o que entrou depois da hora do backup);
- "última mensagem no backup" perto do horário do backup escolhido.

> Atenção: o backup do banco **não inclui os arquivos do Storage** (fotos, áudios, PDFs do
> WhatsApp e anexos de campanha). Num incidente, as mensagens voltam, mas esses arquivos
> dependem do Storage continuar de pé.

### 3. Conferência manual rápida (5 min)
No SQL Editor do projeto restaurado, conferir 2–3 coisas reais que você conhece:
uma conversa recente da Urolaser, uma campanha de Disparos, um paciente da agenda.

### 4. Encerrar
1. Apague a linha `RESTORE_TEST_URL` do `.env`.
2. Supabase → projeto restaurado → **Settings → General → Delete project**.
3. Registre abaixo.

## Registro dos testes

| Data | Backup usado | Tempo p/ restaurar | Resultado | Observações |
|------|--------------|--------------------|-----------|-------------|
| 31/10/2026 | diário de 31/10 ~00:40 UTC | (anotar) | ✅ 48 tabelas, nenhuma faltando/vazia | Diferenças só do que entrou depois (41 mensagens, 3 conversas). Arquivos do Storage (mídias) NÃO estão no backup do banco. |
