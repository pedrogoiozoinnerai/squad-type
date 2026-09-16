Substitua o Cal.com pelo agendamento do nosso próprio CRM (MeetSquad). O CRM já
está pronto e com a API no ar — seu trabalho é só o lado do funil.

## O que muda para o lead

Hoje o passo SCHEDULE mostra o iframe do Cal.com. Passa a mostrar a lista de
sessões de apresentação com vaga, vinda do CRM. O lead escolhe uma, e recebe o
link da sala.

Não é um calendário de horários avulsos: são **sessões coletivas recorrentes**
("toda terça e quinta às 10h", 20 vagas). O CRM já as materializa sozinho.

## A API do CRM (pronta e testada)

Base: `process.env.CRM_URL` (ex.: `https://squad-crm.vercel.app`).

### 1. Disponibilidade — público, sem chave

```
GET {CRM_URL}/api/agenda/disponibilidade
```

```json
{
  "timezone": "America/Sao_Paulo",
  "sessoes": [
    {
      "id": "cmu35xo810000yncc9n0b2264",
      "inicioEm": "2026-09-16T13:00:00.000Z",
      "duracaoMin": 45,
      "lotacao": 20,
      "inscritos": 3,
      "vagas": 17
    }
  ]
}
```

Só vêm sessões com vaga, a partir de 15 minutos no futuro, até 21 dias à frente,
já ordenadas. Sessão cheia some da lista sozinha. Resposta cacheada por 30s.

`inicioEm` é UTC — formate em `America/Sao_Paulo` na tela.

### 2. Reserva — exige chave, e só do SERVIDOR

```
POST {CRM_URL}/api/agenda/reservar
Authorization: Bearer {FUNIL_API_KEY}
Content-Type: application/json
```

```json
{
  "meetingId": "<id da sessão escolhida>",
  "typeSessionId": "<o sessionId do lead no funil>",
  "nome": "Ana Paula Souza",
  "email": "ana@empresa.com.br",
  "telefone": "+5511999990001",
  "empresa": "Empresa A",
  "segmento": "Tecnologia",
  "cargo": "Diretora",
  "faturamento": "1-10M",
  "utmSource": "instagram",
  "utmMedium": "cpc",
  "utmCampaign": "setembro"
}
```

`meetingId`, `typeSessionId` e `nome` são obrigatórios; o resto é opcional.

Respostas:

| Código | Corpo | O que fazer |
|---|---|---|
| 200 | `{ ok, jaEstava, convite, reuniao: { id, comecaEm } }` | Sucesso. `convite` é a URL da sala. `jaEstava: true` quando já estava inscrito — trate igual a sucesso, é a mesma reserva. |
| 409 | `{ erro, lotada: true }` | A sessão encheu entre a escolha e o clique. **Recarregue a lista e peça para escolher outra** — não é erro, é corrida normal. |
| 409 | `{ erro }` sem `lotada` | Sessão cancelada ou já começada. Recarregue a lista. |
| 401 | `{ erro }` | Chave errada ou ausente. |
| 400 | `{ erro }` | Faltou campo obrigatório. |
| 503 | `{ erro }` | `FUNIL_API_KEY` não configurada no CRM. |

**A chave nunca pode ir ao navegador.** Chame de uma rota de API do funil, não
do componente. Quem tiver a chave pode inscrever qualquer pessoa em qualquer
sessão.

A reserva é idempotente por `typeSessionId`: reenviar devolve a mesma inscrição.

## O que existe hoje no funil

- `src/components/funnel/ScheduleStep.tsx` — o embed `<Cal namespace="diagnostico" …>`, o listener `bookingSuccessful`, o pré-preenchimento com `metadata[sessionId]`, e o componente `Confirmacao` com o link do Google Agenda.
- `src/components/funnel/FunnelChat.tsx` — em `currentStep === "SCHEDULE"` esconde a barra de input e renderiza o `ScheduleStep`; `handleScheduled` chama `submitSchedule` e dispara `fbTrack("Schedule")`.
- `src/app/api/leads/[sessionId]/schedule/route.ts` — grava o booking vindo do cliente e marca `status: COMPLETED`.
- `src/app/api/webhooks/cal/route.ts` — webhook do Cal.com, 3 eventos.
- `src/lib/api-client.ts` — `submitSchedule`, com retry.
- `src/lib/funnel.ts:111-115` — schema Zod do passo SCHEDULE.
- `package.json` — `@calcom/embed-react`.
- `.env.example` — `NEXT_PUBLIC_CAL_LINK`, `CAL_WEBHOOK_SECRET`.

## O que construir

1. **`GET /api/agenda`** no funil — busca a disponibilidade no CRM e devolve ao
   cliente. Serve de proxy para não expor a URL do CRM no bundle e para você
   poder tratar a indisponibilidade dele num lugar só.

2. **`POST /api/leads/[sessionId]/reservar`** — recebe `{ meetingId }`, junta os
   dados que o lead já respondeu (nome, e-mail, telefone, empresa, segmento,
   cargo, faturamento, UTMs), chama a reserva no CRM com a chave, e ao dar certo
   grava no `Lead`: `scheduledAt`, `crmMeetingId`, `crmConviteUrl`,
   `status: COMPLETED`, `completedAt`. Devolve o convite ao cliente.

3. **`SessoesDisponiveis.tsx`** no lugar do `ScheduleStep` — lista as sessões
   agrupadas por dia, mostrando dia da semana, hora e vagas restantes. Ao
   escolher, chama a reserva. Em `lotada: true`, recarrega a lista e avisa que
   aquela encheu.

4. **A confirmação** — depois de reservar, mostre o botão "Entrar na reunião"
   apontando para `convite`, e mantenha o link do Google Agenda que já existe
   (`src/lib/google-calendar.ts`), agora usando `comecaEm` e o convite como
   local.

## O que remover

- `@calcom/embed-react` do `package.json` e do lock.
- `src/app/api/webhooks/cal/route.ts` inteiro.
- O embed e o listener em `ScheduleStep.tsx`.
- `NEXT_PUBLIC_CAL_LINK` e `CAL_WEBHOOK_SECRET` do `.env.example`, do README e
  do DEPLOY.
- No painel do Cal.com, o webhook cadastrado (isso é manual, só registre no
  DEPLOY.md que precisa ser feito).

## ⚠ NÃO remova estas colunas do `Lead` ainda

`calBookingUid`, `meetingLocation` e `calCancelledAt`.

O CRM lê essas três colunas por SQL a cada 10 minutos
(`src/lib/type-funnel.ts` no projeto do CRM, cron `/api/cron/type`). Derrubá-las
quebra a sincronização do outro lado na hora. Deixe como estão, nulas para os
novos leads; a remoção é um segundo passo, combinado com o CRM.

## Uma falha de segurança que sai junto

Em `src/app/api/webhooks/cal/route.ts`, a verificação de assinatura inteira está
dentro de `if (secret)`. Com `CAL_WEBHOOK_SECRET` vazio — que é o estado do
`.env.example` — o endpoint aceita qualquer POST não autenticado e permite
marcar qualquer lead como agendado e concluído. Some quando o arquivo for
apagado; registre no commit que era isso.

## Variáveis novas

```
# URL do CRM — de onde vêm as sessões e para onde vai a reserva.
CRM_URL="https://squad-crm.vercel.app"

# Chave compartilhada com o CRM. O MESMO valor nos dois projetos.
# Gere com: openssl rand -hex 32
FUNIL_API_KEY=""
```

## Cuidados

- **Fuso.** `inicioEm` vem em UTC. Formate com `timeZone: "America/Sao_Paulo"`,
  nunca com o relógio do servidor — a Vercel roda em UTC e mostraria 07:00 numa
  sessão das 10:00.
- **O duplo caminho de escrita some.** Hoje existem dois: o cliente via
  `/schedule` e o webhook do Cal. Agora é um só, do servidor, e é bom assim.
- **`status: COMPLETED`** continua sendo definido — o funil só termina quando o
  lead agenda, e isso não muda.
- **Não perca a guarda anti-duplicação.** O comentário em `ScheduleStep.tsx:47`
  explica um bug real: `onScheduled` recriada a cada render registrava um
  listener novo e gerava agendamento e pixel duplicados. O listener some com o
  embed, mas mantenha a proteção contra duplo clique no botão de reservar.
- **`fbTrack("Schedule")`** continua disparando, uma vez só, na confirmação.

## Como verificar

1. `npm run build` verde e sem `@calcom` em lugar nenhum do `src/`.
2. Com o CRM rodando (`localhost:3000`) e o funil em `localhost:3001`: percorra
   o funil até o passo de agendamento, escolha uma sessão, e confirme que o
   `Lead` ficou com `scheduledAt`, `crmMeetingId`, `crmConviteUrl` e
   `status: COMPLETED`.
3. Abra a URL do convite e veja a página de contagem regressiva.
4. Reserve duas vezes seguidas a mesma sessão com o mesmo `sessionId`: a segunda
   tem que devolver `jaEstava: true` sem criar nada novo.
5. Numa sessão com 1 vaga, reserve com dois `sessionId` diferentes: o segundo
   tem que receber 409 com `lotada: true` e a tela pedir outra escolha.
