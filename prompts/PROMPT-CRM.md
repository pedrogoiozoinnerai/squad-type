# Prompt para colar no chat do projeto **CRM**

---

O ecossistema saiu do SQLite. Os três apps (Type, CRM, Dashboard) agora usam
**um único Postgres**: o projeto `master_data` no Supabase (PostgreSQL 17.6,
São Paulo). Isso já foi feito e aplicado — inclusive **neste projeto**, por uma
sessão que rodava na pasta do Type. Leia antes de mexer em qualquer coisa.

## O que já mudou aqui dentro (não refaça)

- `prisma/schema.prisma` → provider `postgresql`
- `src/lib/prisma.ts` → adapter `@prisma/adapter-pg` (`max: 1`, serverless) e a
  constante exportada `DB_SCHEMA`
- `prisma7.config.ts` → a migração usa `DIRECT_URL` e injeta o schema na URL
- `prisma/seed.ts` → adapter novo e **trava de segurança reescrita**: agora ela
  olha o `DB_SCHEMA` (só roda em schema terminado em `_dev`), porque com um
  banco só o que separa dev de produção é o schema, não o tipo de arquivo
- `.env` / `.env.example` → já preenchidos, com senha
- migração inicial criada e **aplicada**: `prisma/migrations/*_init`
- `npm run db:seed` já rodou: 11 usuários, 400 leads, 262 negócios, 246
  reuniões, 5 etapas, 7 motivos de perda, 10 cases

## A regra que organiza tudo: um schema por app

| App | Produção | Dev |
|---|---|---|
| Type | `type` | `type_dev` |
| **CRM (este)** | **`crm`** | **`crm_dev`** |
| Dashboard | `dashboard` | `dashboard_dev` |

Não é preciosismo: **o CRM e o Type têm, os dois, uma tabela `Lead`**, com
estruturas diferentes. No mesmo schema, a migração de um sobrescreveria a do
outro. `DB_SCHEMA` é a fonte de verdade única — o runtime passa ao adapter, o
CLI recebe pela URL.

## O que falta fazer neste projeto

**1. Converter `src/lib/type-funnel.ts` para Postgres.** É a única leitura
cruzada do CRM e continua em dialeto SQLite. Hoje ela abre um cliente
`@libsql/client` e roda:

```sql
SELECT id, sessionId, fullName, ... FROM Lead WHERE status = ? AND fullName IS NOT NULL
```

Três coisas quebram em Postgres:
- **identificador sem aspas** — `Lead`, `sessionId`, `fullName` são rebaixados
  para minúsculo e não existem; o Prisma criou `"Lead"`, `"sessionId"`…
- **falta o schema** — a tabela do funil é `type_dev."Lead"` (dev) ou
  `type."Lead"` (produção). O schema vem de `TYPE_DB_SCHEMA`, que já está no
  `.env`
- **placeholder** — `?` vira `$1`

`TYPE_DATABASE_URL` **já aponta para o mesmo Postgres** do `DATABASE_URL`, então
a alternativa melhor é abandonar a conexão separada e usar
`prisma.$queryRaw` na conexão que já existe — era exatamente o que o comentário
no topo do arquivo previa para quando os dois compartilhassem banco.

Cuidado ao comparar `status`: em Postgres é um enum de verdade
(`type_dev."LeadStatus"`), não texto.

**2. Depois de converter, teste o import de ponta a ponta** em
`/admin/importar`. O funil ainda não tem leads `COMPLETED` no banco novo — crie
um manualmente, ou peça para a sessão do Type gerar um seed.

**3. Criar o `Deal` no import** (pendência antiga, agora mais urgente). Hoje o
import cria `Lead` e `Meeting`, mas nenhum negócio — e o Dashboard mede receita
e pipeline por `Deal`, então o lead importado fica invisível na tela de Receita.
Crie na primeira etapa do pipeline, `valueCents: 0`, `status: OPEN`.

**4. Deploy na Vercel.** O repositório é
`github.com/pedrogoiozoinnerai/squad-crm` (já no ar, branch `main`). As
variáveis de produção estão listadas em `../Type/DEPLOY.md`; o essencial:
`DATABASE_URL` e `DIRECT_URL` do `master_data`, `DB_SCHEMA=crm`,
`TYPE_DATABASE_URL` **igual** ao `DATABASE_URL`, `TYPE_DB_SCHEMA=type`,
`ALLOWED_EMAIL_DOMAIN=innerai.com`.

As migrações de produção rodam da máquina, **não no build**:
`DB_SCHEMA=crm DIRECT_URL="<direct do master_data>" npx prisma migrate deploy`.

## Não mexa

Nos nomes de coluna que o Dashboard lê — `Deal.wonAt`, `lostAt`, `valueCents`,
`status`, `stageId`, `ownerId`, `probability`, `lossReasonId`; `Lead.createdAt`,
`utmSource`, `score`, `segment`, `typeLeadId`; `Meeting.startsAt`, `status`;
`Stage.name/order/color`; `LossReason.name/orderIndex`; `User.name/email/active`.
Renomear qualquer uma quebra as seis telas que o Dashboard alimenta com este
banco. Se precisar mudar, avise antes.

Também não mexa na UI, no pipeline, no outbox de WhatsApp nem nas permissões.

Ao terminar, me diga: (a) se optou por `$queryRaw` ou por conexão separada em
`type-funnel.ts`, (b) se o import passou a criar `Deal`, e (c) se o build
(`npm run build`) e o import continuam passando.
