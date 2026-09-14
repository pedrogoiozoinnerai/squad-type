# O ecossistema — como o Type conversa com o CRM e o Dashboard

> Escrito em 2026-09-13, lendo os três projetos em
> `Projetos/Inner AI/Projetos/{Type,CRM,Dashboard}`.

```
  TYPE :3001  ──▶  CRM :3000  ──▶  DASHBOARD :3002
  capta            opera            mede (só leitura)
```

Mesma stack nos três (Next.js 16 + Prisma 7 + Tailwind 4), mesmo design system
(Fustat + paleta Waz + `#faf9f7`), mesmo domínio de e-mail para acesso
(`@innerai.com`). Isso é uma vantagem grande e precisa ser preservada: o que se
aprende num projeto vale nos outros.

## O CRM (`:3000`)

CRM de vendas completo, com login, dois espaços (admin × vendedor), pipeline
kanban, painel do negócio, tarefas que nascem da etapa, agenda, CSV e permissão
por *feature*. Modelagem herdada da engenharia reversa do CRM da Viver de IA:
dinheiro em centavos, motivo de perda como tabela, etapa com papel dono.

**Como ele consome o Type hoje** (`src/lib/type-funnel.ts` + `/admin/importar`):

- abre uma conexão **só leitura** no `dev.db` do funil (`TYPE_DATABASE_URL`);
- lê os leads com `status = COMPLETED` e `fullName` preenchido (limite 500);
- cria o lead no CRM com contato, cargo, setor, faturamento e **UTMs
  preservadas**; quem já agendou entra também no calendário;
- a ponte são duas colunas `@unique`: `typeLeadId` e `typeSessionId` — por isso
  reimportar é idempotente.

Verifiquei: o caminho relativo `file:../Type/dev.db` **funciona** (o libsql
resolve a partir do cwd do processo). Não é o problema que a documentação do
Dashboard sugere.

**Três limitações que afetam o Type:**

1. **A importação é manual e é *pull*.** Alguém precisa entrar em
   `/admin/importar` e clicar. Um lead que agenda às 23h só existe no CRM quando
   um admin lembrar. O certo é o Type **empurrar** (webhook/Server Action) no
   momento em que o lead completa o funil.
2. **Só entra quem chegou ao fim.** `status = COMPLETED` significa que quem
   preencheu nome, WhatsApp e e-mail mas não agendou **não vira lead no CRM** —
   embora seja um lead perfeitamente trabalhável. Hoje esse contato existe só no
   banco do funil e no HubSpot.
3. **O import não cria `Deal`.** Registrado no próprio `prompts/PROMPT-CRM.md`:
   o lead importado fica invisível na tela de Receita do Dashboard até alguém
   criar o negócio na mão.

## O Dashboard (`:3002`)

Dez telas de receita e aquisição. Lê os bancos do Type e do CRM e **nunca
escreve neles**; só escreve no próprio (metas, custos, canais, times).

**O que ele lê do Type** (`src/lib/sources/type.ts`): a tela `/funil` calcula
abandono passo a passo a partir de `currentStep` + `status`, e o overview usa
`scheduledAt` e `completedAt`. É a substituta do módulo de Google Analytics do
dashboard de referência — e melhor, porque o dado é exato.

**Contrato que o Type não pode quebrar** (renomear qualquer uma quebra a tela):

`createdAt` · `status` · `currentStep` · `completedAt` · `scheduledAt` ·
`utmSource` · `utmMedium` · `utmCampaign` · `role` · `segment` ·
`revenueRange` · `state`

E os valores de `utmSource` precisam cair no de-para de canais do Dashboard:
`google`, `instagram`, `youtube`, `facebook`, `indicacao`, `outbound`,
`organic`.

**O que trava o Dashboard hoje, e a culpa é do Type:**

- `ABANDONED` nunca é gravado → a tela mostra abandono zero;
- o banco tem 6 sessões, todas paradas no passo 1 → não há o que medir.

Ambos estão pedidos em `Dashboard/prompts/PROMPT-TYPE.md` e entraram no plano.

## Produção: um Postgres só

Os três apps migram para **a mesma instância**. Isso tem que ser uma operação
coordenada: no momento em que o Type troca o `provider` para `postgresql`, o
CRM perde o sentido de ter `TYPE_DATABASE_URL` e o Dashboard precisa apontar
`DATABASE_URL`, `CRM_DATABASE_URL` e `TYPE_DATABASE_URL` para a mesma URL.

Três bancos SQLite hoje, um Postgres amanhã — e `readFunnelLeads()` vira um
`$queryRaw` na conexão que já existe.

## O que falta no ecossistema inteiro (não só no Type)

- **Nenhum dos três projetos está em git.** Nem histórico, nem rollback, nem CI.
- Nenhum tem teste automatizado.
- O Meet (LiveKit) é o quarto app previsto; `Meeting.roomId` já está reservado.
- WhatsApp: o CRM tem a fila (`SendQueue`) modelada, sem worker. O Type poderia
  mandar a confirmação da reunião por lá em vez de depender só do Cal.com.
