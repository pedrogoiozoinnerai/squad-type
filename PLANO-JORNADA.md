# Plano — a jornada do lead, de ponta a ponta

> Escrito em 2026-09-17, lendo o código dos três apps e **conferindo a produção
> ao vivo**. Substitui, para efeito de jornada, as fases do `PLANO.md` que ainda
> falavam de Cal.com e HubSpot.
>
> O recorte é um só: **o que o lead vive**, do primeiro balão do Waz até o
> vendedor abrir o negócio dele no CRM. O que não afeta essa linha (Dashboard,
> seed, CI) fica fora de propósito.

Legenda de esforço: 🟢 minutos · 🟡 horas · 🔴 dias.
"Quem": **eu** = executo aqui · **você** = credencial, decisão ou operação.

---

## O que eu verifiquei em produção hoje

Não é leitura de código, é resposta de servidor:

| Checagem | Resultado |
|---|---|
| `squad-type.vercel.app/api/health` | banco ok, schema `type`, **23 leads**, commit publicado |
| `squad-type.vercel.app/api/agenda` | **200 com sessões reais**, vindas do CRM |
| `squad-crm.vercel.app/api/saude` | banco ok, schema `crm`, 5 etapas, **35 usuários — 1 assumida** |
| `squad-crm.vercel.app/api/agenda/disponibilidade` | horizonte até 01/10, sessões de hora em hora, 20 vagas |
| `POST /api/livekit/token` (token falso) | **404 "convite inválido"**, não 503 → **LiveKit está configurado** |

**A conclusão que importa:** o caminho técnico está inteiro e de pé. O lead
consegue conversar, escolher horário, reservar, receber o link e entrar numa
sala de vídeo que funciona, e o vendedor recebe o lead com negócio, dono e
linha do tempo. O que falta não é encanamento — é **memória e voz**: o sistema
esquece o lead assim que ele fecha a aba, e nunca fala com ele de novo.

---

## A jornada, estágio por estágio

### Estágio 1 — A conversa (Type)

**Funciona:** 8 passos, personalização por DDD e por cargo, atribuição de UTM em
cookie de 90 dias, gravação progressiva a cada passo, trilha de auditoria.

**O que está quebrado na visão do lead:**

| # | Defeito | Por que dói |
|---|---|---|
| 1.1 | **Recarregar a página perde tudo** — `novaSessao()` gera um id novo a cada carregamento e nada é persistido (`src/lib/session.ts`) | Isso foi uma decisão consciente para não retomar cadastro pela metade. Só que ela vale **também depois de agendar**: quem recarrega a tela de confirmação perde o link da sala para sempre, e não há e-mail nem WhatsApp para recuperá-lo. É o pior momento possível para esquecer alguém |
| 1.2 | **Cada carregamento cria um `Lead`** — a criação dispara na montagem do chat (`src/lib/api-client.ts`) | Quem abre e sai vira linha no banco. O CRM não importa essas linhas (o filtro dele exige nome + status), então o vendedor está protegido — mas a base do Type e as métricas do Dashboard enchem de lixo, e `ABANDONED` nunca é gravado, então o abandono real é invisível |
| 1.3 | **Sem rate limit nas rotas `/api/leads/*`** | O CRM já tem `guardaDeTaxa` nas rotas públicas dele. O Type não tem nenhuma. Qualquer um injeta lead em massa na base que alimenta CRM e Dashboard |
| 1.4 | **Quem refaz o funil vira um segundo lead** | Sem dedupe por e-mail/telefone, a mesma pessoa entra duas vezes no CRM e pode ocupar duas vagas na mesma sessão |

### Estágio 2 — O agendamento

**Funciona, e bem:** calendário de mês, agrupamento por dia no fuso de Brasília,
escassez só quando é verdade, corrida de lotação tratada como corrida (409 →
recarrega a lista, preservando o dia escolhido), reserva idempotente por
`typeSessionId`, retentativa só no que é seguro repetir.

**O buraco:**

| # | Defeito | Por que dói |
|---|---|---|
| 2.1 | **Nenhuma mensagem chega ao lead. Nunca.** `SendQueue` e `WhatsappInstance` existem no schema do CRM e **nenhuma linha de código as lê ou escreve**. Não há biblioteca de e-mail em nenhum dos três projetos | O lead agenda, fecha a aba e o sistema inteiro fica em silêncio até a hora da call. Sem confirmação, sem lembrete, sem link. Já houve uma tela dizendo que a mensagem chegaria — foi corrigida ontem justamente porque era mentira. A tela agora diz a verdade, mas a verdade é ruim |
| 2.2 | **Sem lembrete, o no-show é o custo invisível** | Sessão coletiva marcada com dias de antecedência, sem nenhum toque no meio, tem comparecimento baixo por construção |
| 2.3 | **Não há como recuperar o convite** | Perdeu o link, acabou. Não existe "reenviar meu convite" em lugar nenhum |
| 2.4 | **`CONFIRMADO` / `confirmedAt` nunca são preenchidos** | O campo existe, as consultas o leem, e nada o escreve: o lead não tem como dizer "eu vou", e o time não tem previsão de sala cheia |
| 2.5 | **A grade em produção é a de teste** — sessões de hora em hora, 20 vagas, todo dia | É a agenda que o lead vê **agora**. Antes de qualquer tráfego, ela tem de virar a grade real do time |

### Estágio 3 — A sala (MeetSquad)

**Funciona:** convite público por token de 32 bytes (nunca o id da reunião),
sala abre 30 min antes e fecha 120 min depois, a mesma régua na tela e na API
(o botão nunca promete o que a rota recusa), consentimento de gravação na
entrada, chat, remarcação pelo próprio convite, presença medida por webhook e
reconciliada de hora em hora.

| # | Pendência | Por que dói |
|---|---|---|
| 3.1 | **Confirmar o webhook do LiveKit no painel** | O cron de presença é a rede de segurança, não o caminho principal. Sem o webhook cadastrado, a presença só aparece até uma hora depois — e o vendedor que abre o CRM logo após a call não vê nada |
| 3.2 | **Ninguém entrou nessa sala como lead de verdade** | Convite no celular, 4G, navegador embutido do Instagram, permissão de câmera negada. É onde a jornada realmente quebra, e não dá para saber lendo código |
| 3.3 | **Sala sem host** | Se o time não entrar, o lead fica sozinho numa sala vazia sem nenhuma orientação |

### Estágio 4 — O vendedor, no CRM

**Funciona, e é a parte mais bem resolvida:** a reserva cria o lead no mesmo
instante (não espera cron), com dono, origem `funil_type` e uma atividade na
linha do tempo dizendo de onde veio e para quando marcou. O cron de 10 minutos
cria o negócio na primeira etapa, reconcilia o estado inteiro (não aplica
eventos, então uma execução perdida se conserta sozinha), e abre tarefa de
"retomar contato" quando o lead cancela. Quem respondeu tudo e **não** agendou
entra como `funil_type_sem_agenda` — a fila mais quente do funil, separada.

| # | Defeito | Por que dói |
|---|---|---|
| 4.1 | **A presença da sessão coletiva não chega ao negócio** — `reconciliar.ts` só escreve `Deal.attendance` quando `reuniao.dealId` existe, e sessão vinda de template não tem `dealId` (nem poderia: uma sessão serve 20 negócios) | O roster sabe quem ficou quantos segundos; o pipeline continua sem saber se o lead apareceu. Falta a ponte roster → negócio |
| 4.2 | **Nenhuma tarefa nasce para quem agendou** | Só o cancelamento gera tarefa. Quem marcou não gera "preparar a call" antes nem "follow-up" depois — o vendedor precisa lembrar sozinho |
| 4.3 | **Duas regras de dono convivendo** | Quem agenda fica com o dono da sessão (`/api/agenda/reservar`); quem não agenda entra no rodízio (`type-sync`). Não está errado — mas é silencioso, e concentra toda a sessão numa carteira só |
| 4.4 | **35 contas, 1 assumida** (verificado em produção) | O rodízio só distribui entre contas assumidas por gente ativa. Hoje, na prática, tudo cai numa pessoa |

---

## O plano

### Fase A — Dar memória e voz ao sistema

É aqui que está 80% do valor. Sem esta fase, todo o resto é um funil que
funciona uma vez e esquece a pessoa.

| # | O quê | Esforço | Quem |
|---|---|---|---|
| A1 | **Persistir o agendamento concluído no navegador** (só ele: sessionId + link do convite + horário). Recarregar volta para a tela de confirmação em vez de recomeçar do zero. Não reabre cadastro pela metade, então não conflita com a decisão de não retomar o funil | 🟡 | eu |
| A2 | **Página de recuperação de convite** no CRM: a pessoa informa e-mail ou WhatsApp e recebe o link de novo. Enquanto não houver envio, mostra o link na tela após checagem | 🟡 | eu |
| A3 | **E-mail transacional de confirmação**, com o `.ics` anexo. Provedor sugerido: Resend, domínio próprio verificado | 🟡 | eu + você (conta/domínio) |
| A4 | **Ligar a `SendQueue`**: worker + cron no CRM, com estados, retentativa e log. O modelo já existe; falta quem o execute | 🔴 | eu |
| A5 | **WhatsApp de confirmação e lembretes** (24 h antes, 1 h antes, "a sala abriu"). Depende de escolher o provedor — é a decisão que mais muda o comparecimento | 🔴 | eu + você (provedor) |
| A6 | **Botão "confirmo presença"** no convite, gravando `CONFIRMADO`/`confirmedAt`, com o número aparecendo na sessão para o time | 🟡 | eu |

### Fase B — Aguentar tráfego sem sujar a operação

| # | O quê | Esforço | Quem |
|---|---|---|---|
| B1 | **Rate limit + honeypot** em `/api/leads/*`, portando o `guardaDeTaxa` do CRM | 🟡 | eu |
| B2 | **Criar o `Lead` só no primeiro passo respondido**, não na montagem da tela | 🟢 | eu |
| B3 | **Marcar `ABANDONED`** por cron, corte em 24 h sem atualização | 🟡 | eu |
| B4 | **Dedupe por e-mail/telefone** na entrada do CRM, para quem refaz o funil não virar dois leads e duas vagas | 🟡 | eu |
| B5 | **Sentry + um e2e do caminho feliz** (conversa → reserva → confirmação) | 🔴 | eu |

### Fase C — A sala pronta para gente de verdade

| # | O quê | Esforço | Quem |
|---|---|---|---|
| C1 | Cadastrar/conferir o **webhook do LiveKit** no painel | 🟢 | você |
| C2 | **Ensaio de sala**: eu percorro o funil em produção, entro pelo convite no celular, e a gente mede o que quebra | 🟡 | eu + você |
| C3 | Texto de sala sem host, e o que o lead vê se chegar 40 min antes | 🟢 | eu |
| C4 | **Trocar a grade de teste pela grade real** de sessões | 🟢 | você |

### Fase D — O vendedor recebendo direito

| # | O quê | Esforço | Quem |
|---|---|---|---|
| D1 | **Ponte roster → negócio**: a presença medida na sessão coletiva vira `attendance` do negócio de cada inscrito, respeitando `attendanceManual` | 🟡 | eu |
| D2 | **Tarefa automática** de preparação (antes) e de follow-up (depois), inclusive a de no-show | 🟡 | eu |
| D3 | **Unificar a regra de dono** — decisão sua, implementação minha | 🟢 | eu + você |
| D4 | **Time assume as contas** no CRM, senão o rodízio é uma pessoa só | 🟢 | você |

---

## A ordem que eu recomendo

1. **C4 + D4 + C1** — são minutos seus e destravam tudo: agenda real, carteira
   distribuída, presença em tempo real.
2. **A1 + B2 + B1** — uma sessão minha. O lead para de perder o link, a base
   para de encher e as rotas param de ficar abertas.
3. **A3 (e-mail) + A6 (confirmo presença)** — o primeiro toque de volta ao lead.
4. **C2, o ensaio** — só faz sentido depois do e-mail existir, porque é a
   jornada inteira que a gente vai medir.
5. **A4 + A5 (fila + WhatsApp)** — o que realmente derruba no-show.
6. **D1 + D2 + B3 + B4** — fecha o ciclo do vendedor e a medição do funil.
7. **B5** — a rede que segura tudo isso depois.

## O teste que declara "pronto"

Um único ensaio, em produção, com um lead de verdade (você ou alguém do time):

1. Entrar pelo anúncio com UTM na URL, navegar para outra página, voltar, e
   confirmar que a UTM sobreviveu.
2. Responder os 8 passos e reservar.
3. **Recarregar a página** e ainda ver o link da sala (hoje falha — item A1).
4. **Receber a confirmação** por e-mail e WhatsApp (hoje não existe — A3/A5).
5. Entrar na sala pelo celular, em 4G, 10 minutos antes.
6. Sair, e confirmar no CRM: lead com dono, negócio na primeira etapa,
   atividade na linha do tempo, presença medida, `attendance` do negócio
   preenchido (hoje falha — D1), e uma tarefa de follow-up (hoje falha — D2).

Enquanto qualquer passo desses falhar, o funil não está pronto para mídia paga —
está pronto para teste.

## Decisões que só você toma

- **Provedor de WhatsApp** (o `WhatsappInstance` no schema sugere instância
  própria; confirmar antes de eu escrever o worker).
- **Provedor de e-mail e domínio remetente.**
- **A grade real de sessões**: dias, horários, lotação e quem conduz.
- **Regra de dono**: o lead que agenda fica com quem conduz a sessão, ou entra
  no rodízio como todo mundo?
- **Corte de `ABANDONED`**: proponho 24 h.
- **Lembretes**: 24 h + 1 h + "a sala abriu" é a minha proposta; mais que isso
  vira spam, menos que isso não segura o comparecimento.
