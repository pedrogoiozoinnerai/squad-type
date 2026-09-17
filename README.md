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
8. Agendamento da reunião (sessões coletivas do CRM)

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
| `CRM_URL`                                | sim\*       | Base do CRM que guarda as sessões (ex: `https://squad-crm.vercel.app`).      |
| `FUNIL_API_KEY`                          | sim\*       | Chave compartilhada com o CRM. Só no servidor — nunca `NEXT_PUBLIC_`.        |
| `NEXT_PUBLIC_ATTRIBUTION_COOKIE_DOMAIN`  | não         | Ex: `.squad.com`, para compartilhar UTMs entre subdomínios.                  |

\* Sem `CRM_URL` e `FUNIL_API_KEY`, a última etapa avisa que não há horários
e o lead não consegue agendar.

## Banco de dados

- **Local**: SQLite via driver adapter `@prisma/adapter-libsql` (não exige Postgres/Docker instalado).
- **Produção e desenvolvimento**: Postgres no projeto `master_data` do Supabase,
  um schema por app (`type` e `type_dev`). Ver [`DEPLOY.md`](DEPLOY.md).

Modelo principal: `Lead` (uma linha por sessão de funil, atualizada
progressivamente a cada passo) + `LeadEvent` (trilha de auditoria de cada
resposta enviada).

## Agendamento (sessões do CRM)

Não é um calendário de horários avulsos: são **sessões coletivas recorrentes**
de apresentação, com lotação. O CRM (MeetSquad) as materializa e guarda as
inscrições; o funil só mostra o que tem vaga e reserva.

1. No CRM, crie o modelo de sessão recorrente e deixe as instâncias geradas.
2. Gere a chave compartilhada com `openssl rand -hex 32` e coloque o **mesmo
   valor** em `FUNIL_API_KEY` nos dois projetos.
3. Aponte `CRM_URL` para o CRM (`http://localhost:3000` em dev).

O caminho que o lead percorre:

- `GET /api/agenda` — intermedeia a disponibilidade do CRM. Sem chave, porque
  ler a agenda não revela nada além de dia, hora e vagas.
- `POST /api/leads/[sessionId]/reservar` — recebe só o `meetingId`. Nome,
  contato, empresa e UTMs saem do `Lead` já gravado, não do corpo do pedido:
  quem abrir o console não consegue inscrever outra pessoa.
- Ao dar certo, grava `scheduledAt`, `crmMeetingId`, `crmConviteUrl`,
  `status: COMPLETED` e devolve o link da sala.

A reserva é idempotente pelo `sessionId` do funil: reenviar devolve a mesma
inscrição, com `jaEstava: true`. Se a sessão lotar entre a escolha e o clique,
o CRM responde 409 com `lotada: true` e a tela recarrega a lista — é corrida
normal, não erro.

A chave **nunca** vai ao navegador. `src/lib/crm.ts` é `server-only`, então
importá-la de um componente vira erro de build em vez de vazamento.

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
- Configurar `NEXT_PUBLIC_FB_PIXEL_ID`, `CRM_URL` e `FUNIL_API_KEY`.
- Considerar proteção anti-spam/rate limiting nas rotas `/api/leads/*` (fora do
  escopo inicial).
