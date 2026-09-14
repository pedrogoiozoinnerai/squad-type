# Funil de Diagnóstico — Squad.com

Formulário conversacional (estilo Typebot) para captação e qualificação de leads,
inspirado no funil da Viver de IA (`type.viverdeia.ai`). Next.js 16 (App Router) +
Prisma + SQLite (dev) com caminho direto para Postgres em produção.

> **Novo por aqui?** Leia [`CONTEXTO.md`](CONTEXTO.md) primeiro — é o resumo de
> tudo que foi decidido (produto, marca, bugs corrigidos, pendências) e como
> rodar isso numa máquina nova. Este README é a referência técnica detalhada.

## Fluxo

1. Nome completo
2. WhatsApp (BR, com detecção automática de cidade/estado pelo DDD)
3. E-mail
4. Empresa
5. Segmento (dropdown)
6. Cargo (seletor em tela cheia — usado para personalizar a copy e para lead scoring)
7. Faturamento anual (dropdown)
8. Agendamento da reunião (embed do Cal.com)

As mensagens do bot são personalizadas dinamicamente com base nas respostas
anteriores (nome, cidade e cargo) — ver `src/lib/funnel.ts`.

## Identidade visual (Manual da Marca Squad.com)

Aplicado a partir do [manual de marca oficial](https://brunovasconcelos-maker.github.io/squad-brandguide/):

- **Tipografia**: Fustat (Google Fonts, pesos 200–800) via `next/font/google`.
- **Logo**: `public/brand/logo-white.svg` (header, fundo escuro) e
  `logo-black.svg` (disponível para páginas/fundos claros).
- **Cor de acento**: paleta do personagem **Waz** (verde), escala completa
  `waz-10` a `waz-95` definida em `src/app/globals.css`. Usada em botões,
  barra de progresso, bordas de foco e links.
- **Avatar do bot**: imagem oficial do Waz (`public/brand/waz.png`),
  recortada via CSS (`background-position`/`background-size`) em
  `src/components/funnel/BotAvatar.tsx`.
- **Padrão de UX**: inspirado no WhatsApp (referência de produto do brandbook
  da Squad.com) — cabeçalho estilo "conversa aberta" (avatar + nome + status
  em `ProgressBar.tsx`), bolhas com horário e check duplo (cinza → azul
  simulando "lida", em `ChatBubble.tsx`), campos em formato pílula
  (`rounded-full`), fundo off-white com textura pontilhada sutil. Cores e
  fonte continuam sendo as da Squad.com (Waz verde + Fustat), não as do
  WhatsApp.

Para trocar o personagem/cor de destaque no futuro: baixe a pose desejada em
Personagens no manual, substitua `public/brand/waz.png`, e troque a escala
`waz-*` em `globals.css` pela paleta do personagem escolhido (valores também
disponíveis no manual, seção Paleta de Cores).

## Rodando localmente

```bash
npm install
npx prisma migrate dev   # cria o dev.db (SQLite) a partir de prisma/schema.prisma
npm run dev
```

Abra http://localhost:3000.

## Variáveis de ambiente (`.env`)

| Variável                                | Obrigatória | Descrição                                                                    |
| ---------------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`                           | sim         | `file:./dev.db` em dev. Em produção, string de conexão Postgres.              |
| `NEXT_PUBLIC_BRAND_NAME`                 | não         | Nome exibido no cabeçalho e nas mensagens. Padrão: `Squad.com`.               |
| `NEXT_PUBLIC_FB_PIXEL_ID`                | não         | Ativa o Facebook Pixel + advanced matching (nome) quando definido.           |
| `NEXT_PUBLIC_CAL_LINK`                   | não\*       | Link do tipo de evento no Cal.com (ex: `seu-usuario/diagnostico-ia`).        |
| `CAL_WEBHOOK_SECRET`                     | não         | Secret do webhook do Cal.com (ver seção abaixo).                             |
| `NEXT_PUBLIC_ATTRIBUTION_COOKIE_DOMAIN`  | não         | Ex: `.squad.com`, para compartilhar UTMs entre subdomínios.                  |
| `HUBSPOT_ACCESS_TOKEN`                   | não         | Private App Access Token do HubSpot (ver seção abaixo).                     |
| `HUBSPOT_PIPELINE_ID` / `HUBSPOT_STAGE_ID` | não       | Pipeline/estágio onde os deals são criados. Padrão: pipeline/estágio inicial da conta. |
| `HUBSPOT_STAGE_SCHEDULED_ID`             | não         | Estágio para onde o deal move quando o lead agenda a reunião.                |

\* Sem `NEXT_PUBLIC_CAL_LINK`, a última etapa mostra um aviso no lugar do calendário.

## Banco de dados

- **Local**: SQLite via driver adapter `@prisma/adapter-libsql` (não exige Postgres/Docker instalado).
- **Produção**: troque o `provider` do `datasource` em `prisma/schema.prisma` para
  `"postgresql"`, aponte `DATABASE_URL` para o Postgres gerenciado (Neon, Supabase,
  Railway…) e troque o adapter em `src/lib/prisma.ts` para `@prisma/adapter-pg`
  (`npm install @prisma/adapter-pg pg`). Rode `npx prisma migrate deploy`.

Modelo principal: `Lead` (uma linha por sessão de funil, atualizada
progressivamente a cada passo) + `LeadEvent` (trilha de auditoria de cada
resposta enviada).

## Cal.com (agendamento)

1. Crie uma conta em [cal.com](https://cal.com) e um tipo de evento (ex: "Diagnóstico IA — 30min").
2. Copie o link no formato `seu-usuario/nome-do-evento` para `NEXT_PUBLIC_CAL_LINK`.
3. O embed já pré-preenche nome/e-mail/notas (empresa, segmento, cargo) e, ao
   concluir o agendamento, grava o `calBookingUid` no lead via
   `POST /api/leads/[sessionId]/schedule` e marca o status como `COMPLETED`.

### Webhook (confirmação server-side)

O embed confia num evento disparado no navegador do lead (`bookingSuccessful`).
Se o lead fechar a aba um instante depois de agendar, esse evento pode não
disparar. O webhook cobre esse caso, confirmando direto no servidor:

1. No Cal.com: **Settings → Developer → Webhooks → New Webhook**.
2. URL do endpoint: `https://SEU_DOMINIO/api/webhooks/cal`.
3. Evento: marque pelo menos **Booking Created**.
4. Cal.com gera um **Secret** — cole em `CAL_WEBHOOK_SECRET`.
5. Pronto: `src/app/api/webhooks/cal/route.ts` valida a assinatura HMAC e
   confirma o lead como `COMPLETED`, com proteção contra duplicidade caso o
   evento client-side também chegue.

## HubSpot (Contact + Deal por lead)

"Cards" no HubSpot = **Deals** (negócios) num pipeline. A integração cria/atualiza
um Contact (por e-mail) e um Deal associado a cada lead, com uma nota resumindo
a qualificação (segmento, cargo, faturamento, origem).

### Como conectar

1. No HubSpot: **Configurações (⚙) → Integrações → Private Apps → Create a private app**.
2. Dê um nome (ex: "Squad.com — Funil Diagnóstico").
3. Na aba **Scopes**, marque:
   - `crm.objects.contacts.read` e `crm.objects.contacts.write`
   - `crm.objects.deals.read` e `crm.objects.deals.write`
4. Clique em **Create app** → confirme → copie o **Access Token** (começa com
   `pat-...`, só é exibido uma vez).
5. Cole em `HUBSPOT_ACCESS_TOKEN` no `.env` (nunca commitar esse valor).

Por padrão, os deals são criados no pipeline `"default"` e no estágio
`"appointmentscheduled"` (os IDs internos do pipeline de vendas padrão de
qualquer conta nova do HubSpot). Se você usa um pipeline customizado, pegue o
ID interno em **Configurações → Objetos → Deals → Pipelines** (não é o nome
exibido) e configure `HUBSPOT_PIPELINE_ID`/`HUBSPOT_STAGE_ID`. Opcionalmente,
`HUBSPOT_STAGE_SCHEDULED_ID` move o deal de estágio quando o lead agenda.

### Quando o sync acontece

- A partir do passo **E-mail**: cria/atualiza o Contact e o Deal a cada passo
  respondido (`PATCH /api/leads/[sessionId]`).
- No passo **Faturamento** (perfil de qualificação completo): adiciona a nota
  com o resumo da qualificação.
- No **agendamento** (client-side ou via webhook do Cal.com): adiciona uma nota
  "Reunião agendada para..." e move o deal de estágio se `HUBSPOT_STAGE_SCHEDULED_ID`
  estiver configurado.
- Sem `HUBSPOT_ACCESS_TOKEN`, todas as chamadas são no-op silencioso — nada quebra.

Lógica em `src/lib/hubspot.ts`.

## Rastreamento

- **Atribuição dinâmica**: UTMs (`utm_source/medium/campaign/term/content`) e
  click ids (`fbclid`/`gclid`) são capturados a cada carregamento e persistidos
  num cookie próprio (`src/lib/attribution.ts`, 90 dias) — sobrevivem a
  navegações internas mesmo quando a página atual não tem esses parâmetros na
  URL, e são reenviados/atualizados no lead a cada visita (inclusive sessão
  retomada). Para compartilhar entre subdomínios do squad.com, configure
  `NEXT_PUBLIC_ATTRIBUTION_COOKIE_DOMAIN`.
- Facebook Pixel: `PageView` no load, `Contact` ao informar o WhatsApp,
  `CompleteRegistration` ao informar o cargo, `Schedule` ao agendar. Configure
  `NEXT_PUBLIC_FB_PIXEL_ID` com o mesmo pixel do site principal squad.com para
  os eventos contarem na mesma conta de anúncios.

## Antes de ir para produção

- Revisar `/privacidade` e `/termos` com o jurídico (conteúdo é placeholder).
- Trocar o banco para Postgres (ver acima).
- Configurar `NEXT_PUBLIC_FB_PIXEL_ID`, `NEXT_PUBLIC_CAL_LINK`, `CAL_WEBHOOK_SECRET`
  e `HUBSPOT_ACCESS_TOKEN`.
- Considerar proteção anti-spam/rate limiting nas rotas `/api/leads/*` (fora do
  escopo inicial).
