# Prompt para colar no chat do projeto **Dashboard**

---

O ecossistema saiu do SQLite. Os três apps (Type, CRM, Dashboard) agora usam
**um único Postgres**: o projeto `master_data` no Supabase (PostgreSQL 17.6,
São Paulo). Isso já foi feito e aplicado — inclusive **neste projeto**, por uma
sessão que rodava na pasta do Type. Leia antes de mexer em qualquer coisa.

## O que já mudou aqui dentro (não refaça)

- `prisma/schema.prisma` → provider `postgresql`
- `src/lib/prisma.ts` → adapter `@prisma/adapter-pg` (`max: 1`) e `DB_SCHEMA`
- `prisma7.config.ts` → migração via `DIRECT_URL`, com o schema na URL
- `prisma/seed.ts` → adapter novo, trava de segurança por `DB_SCHEMA` (só roda
  em schema `_dev`) e **a leitura cruzada dos closers do CRM já convertida para
  `pg`**, lendo `"${CRM_SCHEMA}"."User" WHERE active = true`
- `.env` / `.env.example` → preenchidos. `CRM_DATABASE_URL` e
  `TYPE_DATABASE_URL` agora recebem **a mesma URL** do `DATABASE_URL`, e o que
  distingue as fontes são `CRM_DB_SCHEMA` e `TYPE_DB_SCHEMA`
- migração inicial aplicada e `npm run db:seed` rodado: 1 usuário, 6 canais,
  12 metas, 2 times, 26 custos — e os 11 closers do CRM distribuídos nos times

## A regra que organiza tudo: um schema por app

| App | Produção | Dev |
|---|---|---|
| Type | `type` | `type_dev` |
| CRM | `crm` | `crm_dev` |
| **Dashboard (este)** | **`dashboard`** | **`dashboard_dev`** |

O CRM e o Type têm, os dois, uma tabela `Lead` — no mesmo schema uma
sobrescreveria a outra. Para você isso é uma boa notícia: as três fontes vivem
na **mesma conexão**, então leitura cruzada agora é só qualificar o schema.

## O que falta fazer neste projeto — é o trabalho principal

**Converter a camada de fontes para Postgres.** São 22 consultas em
`src/lib/sources/` e elas alimentam as dez telas. Enquanto isso não acontece, o
Dashboard **não funciona**: `readFrom()` ainda abre `@libsql/client`, que não
fala com uma URL `postgresql://`.

**1. `src/lib/sources/client.ts`** — troque o `createClient` do libsql por um
`pg.Pool` (um por fonte, reaproveitado; hoje o arquivo abre e fecha conexão por
consulta, o que em Postgres é caro). Preserve o que já está bom: o cache com
`unstable_cache`, a telemetria, a redação da URL nas mensagens de erro, o
`sqlSummary` sem argumentos no log, e o `getSourceHealth` fora do cache.

Duas adaptações mecânicas que economizam reescrever as 22 consultas:
- **placeholders**: as consultas usam `?`; o pg usa `$1, $2`. Converta no
  `executeOnce`, não em cada chamada.
- **linhas**: o pg já devolve objeto plano, então `toPlainRow` fica só com a
  conversão de `bigint` → `Number` (todo `COUNT(*)` volta bigint).

**2. `crm.ts` e `type.ts`** — o dialeto. O que quebra:

| SQLite hoje | Postgres |
|---|---|
| `FROM Lead`, `l.createdAt` | `FROM ${schema}."Lead"`, `l."createdAt"` — identificador sem aspas é rebaixado para minúsculo e não existe |
| `WHERE active = 1` (crm.ts:45, 74, 221, 517) | `WHERE active = true` — booleano de verdade |
| `date(col, '-03:00')` — o helper `localDaySql` (crm.ts:29) | `(col AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date` |
| `julianday(a) - julianday(b)` (crm.ts:522, type.ts:195) | `EXTRACT(EPOCH FROM (a - b))` — e some o `/86400` se quiser dias |
| `substr(col, 1, 7)` para agrupar por mês (crm.ts:21) | `to_char(col, 'YYYY-MM')` — a coluna é `timestamp`, não texto |
| `CAST(x AS INTEGER)` | `::int` (ou `::bigint`) |

O `||` de concatenação e o `SUM(CASE WHEN …)` funcionam igual nos dois — não
precisa tocar.

**3. Schema por fonte.** Cada consulta precisa saber de onde lê:
`${process.env.CRM_DB_SCHEMA}` para as 18 de `crm.ts`, `${TYPE_DB_SCHEMA}` para
as 5 de `type.ts`. Centralize num helper em vez de espalhar `process.env` pelas
consultas — e lembre que schema é identificador, então vai entre aspas duplas na
SQL, nunca como parâmetro.

**4. Rode o teste.** `npm test` — existe um
`src/lib/sources/crm.integration.test.ts`. Ele é o seu paraquedas nesta
conversão: rode antes de começar (para ver o que já falha) e a cada consulta
convertida.

**5. Confira tela por tela** com o banco semeado. A `/funil` vai aparecer vazia
e **isso está correto**: o funil do Type ainda não tem leads no banco novo, e o
seed dele é uma pendência da sessão do Type.

**6. Deploy na Vercel.** Repositório
`github.com/pedrogoiozoinnerai/squad-dashboard` (no ar, branch `main`).
Variáveis em `../Type/DEPLOY.md`; o essencial: `DATABASE_URL` e `DIRECT_URL` do
`master_data`, `DB_SCHEMA=dashboard`, `CRM_DATABASE_URL` e `TYPE_DATABASE_URL`
**iguais** ao `DATABASE_URL`, `CRM_DB_SCHEMA=crm`, `TYPE_DB_SCHEMA=type`,
`ALLOWED_EMAIL_DOMAIN=innerai.com`.

## Não mexa

Na regra que sustenta o projeto: **o Dashboard lê, nunca escreve** nas fontes.
Agora que tudo está na mesma conexão, isso deixou de ser garantido pelo arquivo
separado e passou a ser disciplina — nenhum `INSERT`, `UPDATE` ou `DELETE` em
`crm.*` ou `type.*`.

Ao terminar, me diga: (a) quantas das 22 consultas passaram no teste, (b) se
manteve o cache e a telemetria intactos, e (c) quais telas você conseguiu
conferir com dado real.
