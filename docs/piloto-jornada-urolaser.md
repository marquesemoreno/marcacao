# Piloto da jornada do paciente — Urolaser

Objetivo: testar, com pacientes reais, o caminho lembrete → ficha → Cheguei → senha → TV → Atendida.
Tudo pelo WhatsApp atual, sem mensagem a mais além do lembrete da véspera.

## 1. Preparação (gestão, ~20 min, uma vez)

1. **Ficha prévia** — Painel › Ficha. A "Ficha prévia — Urologia" já está criada, **desligada**.
   Revise as perguntas com um médico; ajuste o que quiser e **ative**. A partir do dia seguinte,
   o lembrete da véspera passa a levar o link pessoal do paciente.
   - O termo de consentimento ainda é rascunho — **revisão jurídica pendente** antes de escalar.
2. **TV da sala de espera** — Configurações › TV › "Novo link de TV". Abra o link no navegador
   da TV (tela cheia). Toque uma vez na tela para liberar o som.
3. **QR de chegada** — Configurações › TV › "QR de chegada": defina o ponto da clínica
   (botão "Usar minha localização" estando na recepção, raio 150 m) e imprima o cartaz.
4. **Totem (opcional)** — se houver tablet/PC com impressora térmica 80 mm: "Novo totem".
5. **Serviços de senha** — confira Consulta / Exame / Resultado (ativos conforme a rotina).
6. **Recepção e médicos** — cada guichê abre Painel › Senhas, informa "Guichê 1" etc. e marca
   os serviços que atende.

## 2. Roteiro do teste (recepção, ~15 min com 1 paciente)

| # | Passo | Esperado | ✔ |
|---|---|---|---|
| 1 | Na véspera, paciente recebe o lembrete | Mensagem com link "Preencha sua ficha" | |
| 2 | Paciente abre o link e envia a ficha | Agenda mostra o selo "ficha enviada" na hora | |
| 3 | No dia (até 2 h antes), paciente toca **Cheguei** | Abre a página da senha (ex.: C001) com posição na fila | |
| 4 | Recepção abre Senhas | Paciente aparece em "Esperando", com nome, horário e médico | |
| 5 | Recepção clica **Chamar próxima** | TV mostra a senha e fala "Senha C, 1…"; celular do paciente vibra e fica verde | |
| 6 | Após o atendimento, **Atendida** | Na Agenda a consulta fica "Atendido" | |
| 7 | Paciente sem link: lê o QR do cartaz | Pede localização, tira a senha, entra na mesma fila | |
| 8 | Paciente fora da clínica tenta o QR | Mensagem "você precisa estar na clínica" | |

Anote horário e o que destoou em cada passo (print do celular ajuda).

## 3. O que medir na 1ª semana

- % de lembretes com ficha enviada.
- % de chegadas pelo Cheguei/QR (vs. balcão).
- Tempo médio da chegada até a chamada (Senhas).
- Reclamações/dúvidas de pacientes sobre o link.

## 4. Pendências fora do piloto

- `index.js` novo da ponte no PC da Urolaser (`medicoUltima` + `statusAtendido`) e `pm2 list`
  sem processos duplicados.
- Significado dos STATUS do sistema da Urolaser (quais contam como atendido).
- Régua de retenção (satisfação, retorno, reativação, aniversário): só com a API oficial
  aprovada pela Meta; o link da ficha precisa entrar no modelo oficial do lembrete.
