# TV da sala de espera (painel de chamada)

## Como funciona
- Configurações › **TV da sala de espera** (gestão): gerar o link da TV e definir a sala fixa de cada médico.
- Quem chama:
  - **Recepção**: Agenda › "Recepção agora" › **Chamar** (marca "Em atendimento" e anuncia) e **Chamar de novo**.
  - **Médico**: login com a função **Médico** (Admin › Clínica › Atendentes › Função = Médico + "Nome na agenda"
    igual ao nome do médico no sistema da clínica). Ele cai direto em `/clinic/medico` — só os pacientes dele de hoje,
    com Chamar / Chamar de novo / Atendido e a sala (dá pra trocar na hora).
- A TV mostra **primeiro nome + inicial** ("Lucas M.") e a voz fala **primeiro + último nome**. Histórico: últimas 4,
  apagado depois de 24 h. O canal em tempo real só leva o id da chamada; a TV busca o resto com o token do link.

## Montar a TV com mini PC / Raspberry Pi
1. Raspberry Pi OS (com desktop) ou qualquer mini PC com Chrome/Chromium, ligado na TV por HDMI, som pela TV.
2. Abrir o navegador em modo kiosk, com som liberado sem toque:
   ```
   chromium-browser --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required "https://www.conectasaudevc.com.br/tv/<TOKEN>"
   ```
   No Windows: atalho com `chrome.exe --kiosk --autoplay-policy=no-user-gesture-required "<link>"`.
3. Colocar o comando para abrir ao ligar (Raspberry: `~/.config/autostart/tv.desktop`; Windows: pasta Inicializar).
4. Desligar a proteção de tela/suspensão do sistema.
5. Voz: precisa de uma voz pt-BR instalada. No Raspberry, se não falar, instalar `espeak-ng` + `speech-dispatcher`
   ou usar um mini PC com Windows/ChromeOS (vozes pt-BR já vêm).

Sem o `--autoplay-policy`, a TV mostra "Toque para ativar o som" — basta um clique/toque cada vez que a página abre.
A página recarrega sozinha às 4h e confere chamadas a cada 20 s se o tempo real cair.

## Vídeos, propaganda e música
- Configurações › TV › "Vídeos e propaganda": links do YouTube (vídeo/playlist) e arquivos próprios (MP4/WEBM até 200 MB,
  imagem até 10 MB, enviados direto ao Storage `whatsapp-media/tv/<clinicId>/`). Rodízio na ordem da lista, volume 15%.
- Com mídia, a TV fica 70% vídeo + 30% chamada; na chamada o vídeo fica mudo e o nome toma a tela inteira.
- Música: um link do Spotify, pausa na chamada. Inteira só com Premium logado no navegador da TV.
- Globoplay/Netflix: impossível (bloqueiam embed).

## Totem de senhas
- Configurações › TV › **Gerar link do totem de senhas** → abrir em `/totem/<token>` (tablet/PC com tela de toque).
- Paciente escolhe **Normal** ou **Preferencial**, digita CPF ou telefone (ou pula). Achando a consulta de hoje
  (telefone; CPF → cadastro/agendamento), a senha fica ligada a ela e a Agenda marca **Chegou**.
- Senha impressa (térmica 80 mm) com QR Code → `/senha/<token>`: posição na fila, atualiza a cada 15 s, vibra na chamada.
  Impressão sem janela: `chrome --kiosk --kiosk-printing "<link>"` com a térmica como impressora padrão.
  Sem impressora: `?imprimir=0` no link (QR na tela).
- Chamada: **Senhas** no menu (recepção) ou "Senhas do totem" na tela do médico. "Chamar próxima" pega a preferencial
  mais antiga, senão a normal mais antiga. A TV mostra a senha e fala "Senha preferencial P, 12, favor dirigir-se ao Guichê 1".
- Serviços (Configurações › TV › "Serviços das senhas"): Consulta (C), Exame (E), Resultado (R) criados na 1ª vez;
  dá pra adicionar e ativar/desativar. Senha = letra + P na preferencial (C001, CP001). Sem serviço ativo: N/P.
  Na tela Senhas cada guichê marca "Atendo:" (salvo no computador); "Chamar próxima" só pega desses serviços.
- QR Code da recepção (celular): link próprio /chegada/<token>; com o ponto da clínica salvo, exige localização (raio 150 m).
- Numeração recomeça todo dia por série. A página do QR só vale no dia.

## Ainda não feito
- Chamar a partir do sistema da clínica (Firebird): depende de saber o que o médico faz lá ao chamar e se isso grava
  algo no banco que a ponte possa ler.

## Chamada a partir do sistema da clínica (Urolaser — CPC/Syshosp)
- O médico abre o atendimento no Prontuário Médico da CPC → o banco grava `MARCACAO.STATUS = 3` + `HORA1`
  (conferido no log de auditoria `LOGSAPI`, 27/11/2026). A ponte vê isso a cada 3 s e avisa o Conecta
  (`POST /api/bridge/tv-call`, mesmo token da integração) → a TV anuncia. Nada muda na rotina do médico.
- Sala: a de `MARCACAO.SALA` (Cadastro de Consultórios = tabela `SALA`) se vier preenchida; senão a sala fixa do
  médico em Configurações › TV (o nome do médico precisa bater com o do sistema).
- **"Chamar Paciente"** (conferido ao vivo 28/11): grava `STATUS = 10` ("Chamou"), `MARCACAO.SALA` = código do consultório
  e uma linha em `PAINELCHAMADA` (`"NOME;Consultório 1"`). A ponte anuncia com a sala escolhida; chamar de novo = nova linha
  = "chamar de novo" na TV. Quem já foi chamado assim não é anunciado outra vez ao abrir o atendimento (STATUS 3).
- Sem "Chamar Paciente" (médico abre o atendimento direto), vale o STATUS 3 com a sala fixa do médico.
- Ligar na ponte: `.env` com `TV_CHAMADA=1` (opcional `CONECTA_URL`, `TV_POLL_MS`) + `pm2 restart`.
  Ao subir, a ponte só memoriza quem já está em atendimento; anuncia só o que mudar depois.
- Diagnóstico: `GET /api/chamadas-log?minutos=30` na ponte mostra o que o sistema gravou em MARCACAO/PAINELCHAMADA/SALA.
- Mesma marcação enviada de novo em até 90 s é ignorada (reenvio de rede); depois disso conta como "chamar de novo".
