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
- Numeração recomeça todo dia (N001, P001). A página do QR só vale no dia.

## Ainda não feito
- Chamar a partir do sistema da clínica (Firebird): depende de saber o que o médico faz lá ao chamar e se isso grava
  algo no banco que a ponte possa ler.
