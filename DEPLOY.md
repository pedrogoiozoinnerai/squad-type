# Deploy — Supabase + Vercel + Cal.com

> Guia do funil (Type). CRM e Dashboard seguem o mesmo roteiro, com as
> diferenças anotadas no fim. Escrito em 2026-09-14.

## O que já está pronto no código

- `prisma/schema.prisma` → provider `postgresql`
- `src/lib/prisma.ts` → adapter `@prisma/adapter-pg`, pool `max: 1` (serverless)
- `prisma7.config.ts` → migrações usam `DIRECT_URL`
- `package.json` → `build` roda `prisma generate` (sem isso a Vercel quebra,
  porque `src/generated/prisma` não é versionado)
- migrações SQLite removidas — serão recriadas em Postgres

Falta: as credenciais, que só você pode gerar.

---

## 1. Supabase — dois projetos

Crie **dois** projetos ([supabase.com/dashboard](https://supabase.com/dashboard) →
New project), ambos na região **South America (São Paulo)** para o funil
responder rápido no Brasil:

| Projeto | Serve para |
|---|---|
| `squad-prod` | produção — compartilhado por Type, CRM e Dashboard |
| `squad-dev` | desenvolvimento na sua máquina |

Guarde a senha do banco no gerenciador de senhas: o Supabase só mostra uma vez.

### As duas URLs de cada projeto

Em **Project Settings → Database → Connection string**, pegue:

| Variável | Qual opção copiar | Porta | Quem usa |
|---|---|---|---|
| `DATABASE_URL` | **Transaction pooler** (acrescente `?pgbouncer=true`) | 6543 | a aplicação em runtime |
| `DIRECT_URL` | **Direct connection** | 5432 | só o `prisma migrate` |

Por que duas: o pooler aguenta as centenas de conexões curtas que o serverless
abre, mas não suporta o DDL e as sessões longas de uma migração. A migração
precisa da conexão direta.

> Se a conexão direta não abrir da sua máquina (Supabase serve `db.<ref>` só em
> IPv6 sem o add-on de IPv4), use a opção **Session pooler** — mesma porta 5432,
> host do pooler, compatível com IPv4.

## 2. Banco de desenvolvimento

Com o `.env` apontando para o `squad-dev`:

```bash
npx prisma migrate dev --name init
```

Isso cria as tabelas `Lead` e `LeadEvent` no Postgres e grava a migração em
`prisma/migrations/` — é ela que a produção vai aplicar depois.

## 3. GitHub — três repositórios

Crie **privados e vazios** (sem README, sem .gitignore, sem licença): repositório
com commit inicial cria um histórico divergente e o primeiro push é recusado.

| Repositório | Pasta local |
|---|---|
| `squad-type` | `Projetos/Type` |
| `squad-crm` | `Projetos/CRM` |
| `squad-dashboard` | `Projetos/Dashboard` |

**Antes do push, a checagem que importa** — os três `.gitignore` já cobrem
`.env*`, `dev.db` e `src/generated/`, e nenhum segredo está rastreado hoje
(conferido). Para confirmar a qualquer momento:

```bash
git ls-files | grep -E "\.env|dev\.db" ; echo "só .env.example acima = ok"
```

### Autenticação

Não há chave SSH nesta máquina, então o remote é **HTTPS** e o primeiro push
pede usuário + senha — e a "senha" é um **Personal Access Token** do GitHub
(Settings → Developer settings → Tokens (classic) → escopo `repo`). O
`osxkeychain` guarda depois do primeiro acerto.

Como o token é seu, **o primeiro push roda no seu terminal**, não no meu.

### Conectar e enviar (por projeto)

```bash
git remote add origin https://github.com/SEU_USUARIO/squad-type.git
git push -u origin main
```

## 4. Vercel — um projeto por repositório

1. **Add New → Project → Import** o repositório.
2. Framework Next.js (detectado), Root Directory `./`, build e install
   **padrão** — o `prisma generate` já está no script de build dos três.
3. Variáveis de ambiente (Production **e** Preview):

**squad-type**

| Variável | Valor |
|---|---|
| `DATABASE_URL` | pooler do `squad-prod` (6543, `?pgbouncer=true`) |
| `DIRECT_URL` | conexão direta do `squad-prod` (5432) |
| `NEXT_PUBLIC_BRAND_NAME` | `Squad.com` |
| `NEXT_PUBLIC_CAL_LINK` | `usuario/diagnostico-ia` (passo 6) |
| `CAL_WEBHOOK_SECRET` | gerado pelo Cal.com (passo 6) |
| `NEXT_PUBLIC_FB_PIXEL_ID` | pixel do site principal |
| `NEXT_PUBLIC_ATTRIBUTION_COOKIE_DOMAIN` | `.squad.com` |

**squad-crm**

| Variável | Valor |
|---|---|
| `DATABASE_URL` · `DIRECT_URL` | mesmas do `squad-prod` |
| `TYPE_DATABASE_URL` | **a mesma** `DATABASE_URL` — em produção o funil vive no mesmo banco |
| `ALLOWED_EMAIL_DOMAIN` | `innerai.com` |
| `NEXT_PUBLIC_BRAND_NAME` | `Squad.com` |

**squad-dashboard**

| Variável | Valor |
|---|---|
| `DATABASE_URL` · `DIRECT_URL` | mesmas do `squad-prod` |
| `CRM_DATABASE_URL` · `TYPE_DATABASE_URL` | **as duas** iguais à `DATABASE_URL` |
| `ALLOWED_EMAIL_DOMAIN` | `innerai.com` |
| `NEXT_PUBLIC_BRAND_NAME` | `Squad.com` |

4. **Migrações em produção** — rodadas da sua máquina, uma vez por app, com o
   `DIRECT_URL` de produção no ambiente:

```bash
DIRECT_URL="<direct do squad-prod>" npx prisma migrate deploy
```

Deliberadamente fora do build: migração no build roda a cada deploy, em
paralelo, e um dia duas rodam ao mesmo tempo.

5. **Seed** — só o CRM e o Dashboard têm (usuários, etapas, motivos de perda,
   canais, metas). Rode uma vez, contra produção, e **troque as senhas do seed
   depois do primeiro login**:

```bash
DATABASE_URL="<pooler do squad-prod>" npm run db:seed
```

6. **Domínios**: `type.squad.com`, `crm.squad.com`, `dash.squad.com` — a Vercel
   informa o CNAME de cada um.

## 5. A ordem entre os três

O Type primeiro: é o único que capta lead e o único que depende do Cal.com. CRM
e Dashboard podem subir depois, sem pressa — mas **as consultas SQL cruzadas
deles ainda estão em dialeto SQLite** e precisam ser convertidas antes
(`julianday()`, `date(x, tz)`, `active = 1` e identificadores sem aspas, que o
Postgres rebaixa para minúsculo). São 24 consultas em
`Dashboard/src/lib/sources/` e `CRM/src/lib/type-funnel.ts`.

## 6. Cal.com

1. Conta em [cal.com](https://cal.com) e um tipo de evento — sugestão:
   "Diagnóstico IA — 30min", com buffer e antecedência mínima.
2. O link tem o formato `usuario/nome-do-evento`. É **só esse trecho** que vai
   em `NEXT_PUBLIC_CAL_LINK` (sem `https://cal.com/`).
3. O embed já pré-preenche nome, e-mail e notas (empresa, segmento, cargo) e
   manda o `sessionId` em `metadata` — é assim que a reserva volta amarrada ao
   lead certo.
4. **Webhook** (Settings → Developer → Webhooks → New):
   - URL: `https://type.squad.com/api/webhooks/cal`
   - Evento: **Booking Created** (no mínimo)
   - Copie o **Secret** gerado para `CAL_WEBHOOK_SECRET` na Vercel
5. Teste agendando você mesmo: o lead precisa terminar com `status = COMPLETED`
   e `calBookingUid` preenchido no banco.

O webhook existe porque o embed depende de um evento no navegador do lead; se
ele fechar a aba logo após confirmar, só o webhook registra o agendamento.
