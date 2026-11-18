# Estudo: central telefônica própria da Conecta Saúde

Data: 18/11/2026. Só estudo: nada foi implementado. Os preços vêm de páginas de fornecedores consultadas nesta data. São **estimativas**: confirmar com proposta antes de decidir.

Ligado a: [análise de ligações](analise-deskcomm-ligacoes.md) e [análise do DeskVoice](analise-deskvoice.md).

## Resumo em 5 linhas

1. Dá para fazer. A central roda numa **VPS própria**, fora da Vercel, com Asterisk ou FreeSWITCH. Ela liga numa **operadora de tronco SIP**, e o número atual da clínica vem por **portabilidade** (fixo para fixo, mesmo DDD, até 3 dias).
2. Custo por clínica: **cerca de R$ 100 a R$ 330 por mês** de telefonia (número + minutos ou plano ilimitado), mais uma VPS **compartilhada entre todas as clínicas** (cerca de R$ 100 a R$ 200 por mês) e aparelhos, se precisar (ATA de 2 portas por cerca de R$ 550 a R$ 610).
3. O maior custo **não é dinheiro, é responsabilidade**: se a central cair, a clínica fica sem telefone. Isso pede monitoramento e suporte em horário comercial, de verdade.
4. Para não precisar de licença da Anatel: **a clínica contrata o tronco e o número no nome dela**, direto com a operadora. Nós entregamos só o software da central. Revender minutos no nosso nome exige autorização da Anatel. Confirmar com advogado de telecom.
5. Recomendação: **não começar pela central**. Primeiro a recuperação pelo WhatsApp (custo zero); depois testar a bilhetagem do Leucotron da Santa Clara; e a central própria entra como **piloto na Urolaser**, onde o PABX é o mais simples e o que menos ajuda.

## 1. O impacto do PABX de cada clínica

| Clínica | PABX | Dá para saber das ligações perdidas sem trocar nada? |
|---|---|---|
| Santa Clara | Leucotron | **Provável.** A linha Ision IP tem integração com CRM e ERP. Falta saber o modelo e se a **bilhetagem** (o registro de cada ligação) inclui a **recebida não atendida** e sai pela rede. Se sair, a ponte que já roda lá lê e manda para nós |
| Urolaser | Intelbras simples | **Difícil.** Nas centrais analógicas simples (linha Conecta/Modulare), a comunicação serial precisa de **placa de comunicação**, e não achei documento dizendo que elas registram a ligação não atendida. O relatório de "recebidas e não atendidas" da Intelbras é de um software da linha Impacta, não das simples |

**Sim, impacta.** Na Urolaser, provavelmente só dá para saber da ligação perdida no fixo trocando a central, seja pela nossa, seja por uma em nuvem. Na Santa Clara, talvez baste a ponte.

Preciso do **modelo exato** dos dois PABX (está na etiqueta do aparelho ou na nota fiscal) para fechar isso.

## 2. As três formas de ter "central"

| | A. Manter o PABX e ler a bilhetagem | B. Contratar PABX em nuvem pronto | C. Construir a nossa central |
|---|---|---|---|
| O que é | A ponte lê o registro de ligações do PABX da clínica | Vono, KVOIP, Vivo ou similar; a clínica usa a central deles | Asterisk/FreeSWITCH na nossa VPS, tronco SIP da operadora |
| Custo mensal | Zero | R$ 30 a R$ 60 por ramal + tronco/minutos | Telefonia (seção 3) + parte da VPS |
| Chamada perdida chega até nós? | Só se o PABX registra (Santa Clara: talvez; Urolaser: difícil) | Só se o fornecedor tiver webhook ou API; perguntar antes | **Sim, por desenho** |
| Atender pelo computador, dentro do painel | Não | Pelo programa deles | **Sim**, se fizermos o telefone no navegador |
| Quem resolve quando cai | O técnico do PABX | O fornecedor | **Nós** |
| Tempo até funcionar | Dias, se o PABX ajudar | Dias | Semanas |

Preços de PABX em nuvem encontrados:
- Vono: R$ 45 por ramal, mínimo de 2, tronco à parte;
- KVOIP: R$ 58 por ramal, ligações ilimitadas;
- Vivo: de R$ 50 por ramal (até 4) a R$ 30 (mais de 30);
- GCLOUD: R$ 38,90, mínimo de 5.

## 3. Custo da central própria (opção C)

### Por clínica (telefonia, paga pela clínica à operadora)

| Item | Faixa encontrada |
|---|---|
| Número fixo | cerca de R$ 25 por mês. A portabilidade costuma ser sem custo |
| Plano ilimitado fixo + celular | de R$ 49,90 a R$ 280 por mês, conforme o fornecedor. Alguns pedem fidelidade de 36 meses e taxa de ativação |
| Ou por minuto | fixo de R$ 0,08 a R$ 0,16; celular de R$ 0,20 a R$ 0,39 |
| Receber ligação | em geral incluído; confirmar na proposta |

Exemplo: clínica com 4 pessoas na recepção que faz 1.500 minutos de saída por mês, 60% para celular. Por minuto, fica entre **R$ 300 e R$ 400**. No plano ilimitado, fica entre **R$ 73 e R$ 280**. Com esse volume, o ilimitado compensa.

### Uma vez por clínica

| Item | Valor |
|---|---|
| Aparelhos | **Opção barata:** telefone no navegador ou no celular (softphone), sem custo de aparelho, só fone de ouvido. **Para manter os telefones atuais:** ATA Intelbras de 2 portas, cerca de R$ 550 a R$ 610 |
| Internet | Precisa ser estável. Um link reserva é recomendado, porque sem internet não há telefone. Pode ter custo extra |
| Implantação | Portabilidade, configuração e treinamento. Sugestão de cobrança: igual à implantação atual (R$ 1.500+) |

### Nosso (dividido entre todas as clínicas)

| Item | Valor |
|---|---|
| VPS para a central | cerca de R$ 100 a R$ 200 por mês. Uma máquina atende várias clínicas; o que pesa são as ligações ao mesmo tempo, não o total do mês |
| Desenvolvimento | **Estimativa minha:** 4 a 8 semanas para a primeira versão (ramais, toque em grupo, horário de atendimento, mensagem de "fora do horário", aviso de ligação perdida para o nosso sistema, telefone no navegador dentro do painel) |
| Manutenção | Atualização, segurança e plantão em horário comercial. Uma central exposta na internet é alvo de fraude: pessoas tentam usar o tronco para ligar ao exterior por conta da clínica. Isso pede trava de destino, limite de gasto e senha forte nos ramais |

### Comparação simples (5 clínicas, 4 ramais cada = 20 ramais)

- **PABX em nuvem:** 20 × R$ 45 = R$ 900 por mês, mais o tronco.
- **Central própria:** cerca de R$ 150 por mês de VPS, mais o tronco, que existe nos dois casos.
- **Diferença:** cerca de R$ 750 por mês a favor da própria, **antes** de contar o desenvolvimento e o suporte.
- **Vira produto:** cobrando R$ 40 a R$ 60 por ramal, como o mercado, 20 ramais dão de R$ 800 a R$ 1.200 por mês de receita.

## 4. Regras e riscos

- **Anatel:** só empresa autorizada pode prestar serviço de telefonia. Se nós **revendermos** número e minutos, precisamos de autorização (STFC) ou de parceria formal com uma operadora. Caminho seguro: **a clínica contrata o tronco no nome dela** e nós entregamos o software. Confirmar com advogado de telecom.
- **Portabilidade:** só de fixo para fixo, no mesmo DDD, em até 3 dias. Há casos de o número ficar 1 ou 2 dias sem receber ligação, então fazer em dia de pouco movimento. Conferir se o plano atual tem multa de fidelidade.
- **LGPD:** gravação **desligada**. Guardamos só o registro: número, hora, duração, atendida ou não e quem atendeu. O registro entra na exportação e no apagamento do titular.
- **CFM:** sem IA falando com paciente por voz (descartado na análise do DeskVoice).
- **Ligação de saída em massa:** não fazemos. Atrai bloqueio da linha.
- **Disponibilidade:** a central é o ponto mais crítico de tudo o que entregamos. Se o painel cai, a recepção ainda tem o telefone; se a central cai, a clínica fica sem nada. Precisa de alerta (já temos o cron de saúde a cada 15 min) e de um plano B: desvio automático para um celular quando a central não responder.

## 5. O que a central própria traz além da chamada perdida

- Atender e ligar **pelo painel**, com a ficha do paciente aberta ao tocar, porque o número já está no CRM.
- **Clique para ligar** a partir do Chat, da Agenda e das Tarefas.
- Relatório de ligações: atendidas, perdidas, tempo para atender e quem atendeu, no `/clinic/relatorio`.
- Mensagem de fora do horário e feriado, usando o mesmo calendário do sistema (`business-hours.ts`, `holidays.ts`).
- Tudo no mesmo histórico do paciente: WhatsApp, SMS, e-mail e ligação.

## 6. Recomendação, em ordem

1. **Agora, sem custo:** recuperação de chamada perdida pelo WhatsApp (evento `CALL` da Evolution), com as regras já decididas (tetos de 3 por hora e 20 por dia, texto sem nome quando a ligação vem do fixo, convite para responder, recusa de ligação desligada).
2. **Santa Clara:** ver se o Leucotron registra a não atendida e manda pela rede. Se mandar, a ponte resolve o fixo sem custo.
3. **Urolaser, piloto da central própria:** o PABX é o mais simples, então é onde a troca mais ajuda. Antes, pedir proposta a 2 ou 3 operadoras de tronco, confirmar a portabilidade e falar com o advogado sobre a Anatel.
4. Se o piloto der certo, oferecer a central como **produto**, cobrado por ramal.

## 7. O que preciso de você

1. Modelo exato do PABX da Santa Clara (Leucotron) e da Urolaser (Intelbras).
2. Quantas pessoas atendem telefone em cada clínica, e se querem continuar com os aparelhos de mesa ou podem usar fone de ouvido no computador.
3. Qual operadora e plano de telefone fixo cada clínica tem hoje, e se há fidelidade.
4. Posso pedir orçamento de tronco? Os nomes das clínicas só entram quando você autorizar.

## Fontes (consultadas em 18/11/2026)

- Planos de tronco e minutos: [Directcall](https://directcall.com.br/produto/planos-ilimitados/), [FiberTel](https://fibertel.com.br/numero-fixo-virtual-brasileiro/), [Alvoko](https://alvoko.com/precos/), [Diskfree](https://www.diskfree.com.br/produtos/plano-de-minutos-para-telefonia-voip-empresarial), [Virtual-Call](https://www.virtual-call.com/br/precos/sip-trunk).
- PABX em nuvem: [Vono](https://falevono.com.br/blog/quanto-custa-um-pabx-virtual-em-2026), [KVOIP](https://kvoip.com.br/pabx/), [Vivo](https://vivo.com.br/para-empresas/por-que-vivo-empresas/vivo-explica/tecnologia-e-conectividade/vantagens-do-pabx-virtual), [GCLOUD](https://gcloud.com.br/blog/pabx-virtual-sob-demanda).
- Portabilidade: [Tecnoblog](https://tecnoblog.net/responde/o-que-e-portabilidade-numerica/), [Estado de Minas](https://www.em.com.br/emfoco/2026/08/04/o-autonomo-de-39-anos-que-usa-o-numero-havia-11-anos-pediu-a-portabilidade-ficou-2-dias-sem-receber-chamada-ouviu-de-cada-operadora-que-a-culpa-era-da-outra-e-so-ao-comparar-o-protocolo-de-cada-uma/).
- Anatel: [perguntas frequentes](https://www.gov.br/anatel/pt-br/regulado/perguntas-frequentes), [autorização do STFC](https://www.gov.br/pt-br/servicos/obter-autorizacao-para-servico-telefonico-fixo-comutado).
- PABX: [Leucotron Ision IP](https://downloads.leucotron.com.br/material-de-comunicacao/produtos/ision-ip.pdf), [guia das centrais analógicas Intelbras](https://backend.intelbras.com/sites/default/files/2021-08/Guia%20b%C3%A1sico%20-%20Centrais%20Anal%C3%B3gicas.pdf), [Intelbras mesa virtual](https://backend.intelbras.com/sites/default/files/2025-06/Manual_mesa_virtual_01-25_site.pdf).
- ATA: [loja Intelbras, ATA 200](https://loja.intelbras.com.br/conversor-de-protocolo-ip-ata-200-intelbras/p).
