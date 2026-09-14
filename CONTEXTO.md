# Contexto do Projeto — Funil de Diagnóstico Squad.com

> Documento de handoff/contexto. Objetivo: qualquer pessoa (ou uma nova sessão do
> Claude Code) consegue entender o projeto, as decisões tomadas e o que falta,
> só lendo este arquivo. Escrito em 2026-09-11.

## 1. O que é isto

Um formulário conversacional (estilo Typebot/chat) para captação e qualificação
de leads da **Squad.com**. O visitante "conversa" com o Waz (personagem/agente
de IA da Squad.com) respondendo 8 perguntas, uma de cada vez, e termina
agendando uma reunião via Cal.com.

**Referência usada para desenhar o funil**: `type.viverdeia.ai` (funil de outra
operação) — foi analisado ao vivo no navegador pra copiar o padrão de UX
(chat, progress bar, personalização por DDD, seletor de cargo em tela cheia,
agendamento embutido).

## 2. Decisões de produto (e por quê)

| Decisão | Por quê |
| --- | --- |
| Funil **fixo** em código (não um construtor visual genérico) | O usuário escolheu essa opção explicitamente — é mais rápido de entregar; um builder visual completo (tipo Typebot) foi considerado e descartado por ora |
| **Next.js 16** full-stack (App Router + API routes) | Menos peças móveis que frontend/backend separados; deploy único |
| **SQLite local** → **Postgres em produção** | Não havia Postgres/Docker disponível na máquina de dev; o schema Prisma já está pronto pra trocar o `provider` |
| **Cal.com** embutido (embed) + webhook | Já é uma ferramenta popular de agendamento; embed cobre o caminho feliz, webhook cobre o caso do lead fechar a aba antes do evento client-side disparar |
| ~~**HubSpot** para CRM~~ — **removido em 2026-09-14** | O CRM próprio (`../CRM`) assumiu o papel: os dois apps dividem o mesmo Postgres, então o lead do funil vira lead do CRM sem integração externa |
| Atribuição dinâmica de UTM (cookie, 90 dias) | Pedido explícito — não pode perder a campanha de origem mesmo se o lead navegar por páginas sem UTM na URL antes de chegar no funil |

## 3. Identidade visual — como chegamos até aqui

O usuário mandou o link do manual de marca oficial:
**https://brunovasconcelos-maker.github.io/squad-brandguide/**

Esse manual define **7 personagens/agentes** da Squad.com (Maky, Waz, Fin,
Pipo, Juri, Opy, Nexo), cada um com sua própria cor — não existe uma "cor
primária" única da empresa fora disso. A logo em si é só preto/branco.

Decisões tomadas em conversa (nesta ordem, cada uma sobrescrevendo/refinando a
anterior):

1. **Personagem escolhido: Waz** (verde, `#2DC86A`) — é o agente de
   atendimento/conversão ("Waz atende e converte"), faz sentido para um funil
   de diagnóstico conversacional. Cor completa em `src/app/globals.css`
   (tokens `waz-10` a `waz-95`).
2. **Avatar do bot = imagem real do Waz** (não um ícone genérico) — baixada do
   manual de marca (`public/brand/waz.png`), recortada via CSS
   (`background-position`/`background-size`) pra focar no rosto dentro de um
   círculo pequeno.
3. **Logo real da Squad.com** baixada do manual (`public/brand/logo-white.svg`
   e `logo-black.svg`), não mais texto solto.
4. **Fonte oficial: Fustat** (Google Fonts, pesos 200–800), carregada via
   `next/font/google` — substitui a fonte padrão do Next.js.
5. **Fundo**: passou por várias iterações a pedido do usuário —
   escuro → branco → verde → **off-white final (`#faf9f7`)**.
6. **Padrão de UX = WhatsApp** (pedido explícito, "é o produto mais usado do
   Brasil, nossa UX é baseada nisso"): cabeçalho estilo "conversa aberta"
   (avatar + nome + status), bolha de mensagem enviada em verde claro com
   **horário + check duplo** (cinza → **azul** depois de ~900ms, simulando
   "lida"), bolha recebida em branco também com horário, campos de texto em
   formato "pílula" (`rounded-full`), fundo com textura pontilhada sutil
   (evocando o papel de parede do WhatsApp, sem copiar o padrão deles).
   **Importante**: usamos o verde do Waz, não o verde/logo reais do
   WhatsApp — é o "padrão de UX" deles, com a marca da Squad.com.

Se um dia quiserem trocar de personagem/cor: baixar a pose desejada na seção
"Personagens" do manual, substituir `public/brand/waz.png`, e trocar a escala
`waz-*` em `globals.css` pela paleta do personagem escolhido (também no
manual, seção "Paleta de Cores").

## 4. O fluxo do funil (8 passos)

1. Nome completo
2. WhatsApp (BR — DDD detectado automaticamente → cidade/estado, personaliza a
   próxima mensagem do bot)
3. E-mail
4. Empresa
5. Segmento (dropdown)
6. Cargo (seletor em **tela cheia** — a copy do bot muda se é decisor
   (Sócio/CEO/C-Level) ou não, e isso também qualifica o lead)
7. Faturamento anual (dropdown)
8. Agendamento (Cal.com embutido)

Todas as mensagens do bot (incluindo a personalização por cidade/cargo) estão
em `src/lib/funnel.ts` — é o lugar certo pra editar copy.

## 5. Arquitetura técnica (visão rápida)

```
src/
  app/
    page.tsx                     → renderiza o funil (client-only, ver FunnelChatLoader)
    layout.tsx                   → fonte Fustat, Facebook Pixel condicional
    privacidade/, termos/        → páginas placeholder (revisar com jurídico!)
    api/
      leads/route.ts             → POST: cria/atualiza sessão + atribuição (UTMs)
      leads/[sessionId]/route.ts → PATCH: salva a resposta de cada passo
      leads/[sessionId]/schedule/route.ts → POST: confirma agendamento (client-side)
      webhooks/cal/route.ts      → POST: confirma agendamento (server-side, via Cal.com)
  components/funnel/             → toda a UI do chat (bolhas, inputs, avatar, header)
  lib/
    funnel.ts                    → roteiro/copy do bot, opções de cada passo, validação (zod)
    ddd.ts                       → mapa de todos os DDDs → cidade/estado
    attribution.ts               → captura/persiste UTMs num cookie (90 dias)
    prisma.ts                    → client Prisma (SQLite via adapter-libsql)
prisma/schema.prisma              → modelos Lead + LeadEvent
public/brand/                     → logo-white.svg, logo-black.svg, waz.png (baixados do manual)
```

Banco: **1 linha por sessão de funil** (`Lead`, atualizada progressivamente a
cada passo) + `LeadEvent` (log de auditoria de cada resposta enviada).

## 6. Bugs encontrados e corrigidos durante o desenvolvimento

Vale registrar porque não são óbvios — se algo parecido reaparecer, é bom saber
que já foi visto:

1. **DDD 55 quebrado**: o código tentava remover um suposto "+55" (DDI) de
   qualquer número começando com "55" — mas 55 também é um DDD real (Santa
   Maria/RS). Corrigido em `src/lib/ddd.ts`.
2. **Tela de cargo travava o usuário**: tinha um botão "✕" que fechava a etapa
   sem nenhuma forma de reabrir (é uma etapa obrigatória). Removido.
3. **Listener duplicado no Cal.com**: a callback de agendamento era recriada a
   cada render do componente pai, registrando um novo listener sem remover o
   anterior → risco de salvar o mesmo agendamento múltiplas vezes. Corrigido
   com uma `ref` estável em `ScheduleStep.tsx`.
4. **Reabria o calendário depois de já ter agendado** (ao recarregar a
   página) — corrigido persistindo um flag `scheduledConfirmed`.
5. **Promises sem tratamento de erro** nas chamadas de API (client) — agora
   logadas em vez de gerar unhandled rejection.
6. **Retry desperdiçado em erro 4xx** — o cliente tentava de novo 3x mesmo em
   erro de validação (nunca teria sucesso). Só re-tenta em erro de rede/5xx.
7. **Barra de progresso 0-indexada** ("0 de 7") — mudada pra 1-indexada
   ("1 de 8"), mais intuitiva.

## 7. Integrações — status atual

| Integração | Status | O que falta |
| --- | --- | --- |
| **Facebook Pixel** | Código pronto (`NEXT_PUBLIC_FB_PIXEL_ID`), advanced matching por nome | Usuário ainda não tem o ID do pixel do site principal squad.com |
| **Cal.com** (embed) | Funcionando, pré-preenche nome/e-mail/notas | Precisa do link real (`NEXT_PUBLIC_CAL_LINK`) |
| **Cal.com** (webhook) | Código pronto em `/api/webhooks/cal` | Precisa configurar o webhook no painel do Cal.com + `CAL_WEBHOOK_SECRET` |
| **CRM próprio** | Mesmo Postgres (`master_data`), schemas `type` e `crm` | O import em `/admin/importar` ainda é manual; empurrar o lead automaticamente está no PLANO.md |
| **Atribuição de UTM** | ✅ Funcionando e testado (cookie 90 dias, sobrevive à navegação) | Nada pendente |

Todas essas variáveis ficam em `.env` (ver `.env.example` para a lista
completa com comentários).

## 8. Pendências / próximos passos (o que só o usuário pode resolver)

- [ ] Pegar o **Facebook Pixel ID** do site principal squad.com
- [ ] Criar o tipo de evento no **Cal.com** e colar o link
- [ ] Configurar o **webhook do Cal.com** (Settings → Developer → Webhooks)
- [ ] Revisar `/privacidade` e `/termos` **com o jurídico** — conteúdo atual é placeholder
- [ ] Trocar SQLite → Postgres antes de ir pra produção (passo a passo no README)

## 9. Ambiente de desenvolvimento (importante pra nova máquina!)

Esta máquina **não tinha Node, npm, Homebrew nem Xcode Command Line Tools**
instalados, e o usuário preferiu não instalar Homebrew. A solução foi instalar
o **Node.js direto do binário oficial**, sem sudo:

```bash
NODE_VERSION="22.14.0"
curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-arm64.tar.gz" -o node.tar.gz
tar -xzf node.tar.gz
mv "node-v${NODE_VERSION}-darwin-arm64" ~/.local/node
```

E adicionado ao PATH no `~/.zshrc`:
```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

**Numa nova máquina**: se ela também não tiver Node, repita esse processo (ou,
se preferir e tiver permissão de admin, instale via Homebrew normalmente —
mais simples de manter atualizado). Depois disso, o projeto roda normal com
`npm install` + `npm run dev`.

Banco local (SQLite) usa `@prisma/adapter-libsql` justamente para não precisar
de Postgres/Docker instalados — funciona em qualquer Mac sem infra extra.

### 9.1 Gotcha: o projeto mora dentro do iCloud Drive

A pasta do projeto está em `~/Library/Mobile Documents/iCloud~md~obsidian/...`
(o cofre do Obsidian, sincronizado pelo iCloud). Isso quebra o `next dev` de um
jeito não óbvio:

- O iCloud **despeja (evicts)** arquivos grandes que ficam sem uso — inclusive
  os binários nativos `.node` (`@next/swc-darwin-arm64`, `lightningcss`,
  `@tailwindcss/oxide`). Quando isso acontece, o Next cai no fallback WASM e o
  Turbopack morre com *"Turbopack is not supported on this platform"*, ou o
  webpack falha com *"Cannot find module"*.
- Enquanto o arquivo está nesse estado "dataless", o macOS também recusa
  carregá-lo: *"library load disallowed by system policy"*.

**Correção (feita em 2026-09-12)**: `rm -rf node_modules && npm install` —
reinstalar materializa os binários no disco e o `npm run dev` volta a subir com
Turbopack normalmente. Se voltar a quebrar depois de dias sem usar, é o iCloud
despejando de novo: repita o reinstall.

**Não** aponte `node_modules` nem `.next` para fora do projeto via symlink:
o `npm install` apaga o symlink de `node_modules`, e um `.next` symlinkado
quebra a resolução de módulos do PostCSS/Tailwind (o chunk gerado tenta
resolver `@tailwindcss/postcss` a partir do diretório do link).

**Solução definitiva**, se o incômodo voltar: mover a pasta do projeto para um
caminho local de verdade (ex: `~/Developer/squad-funil`) e deixar só os
markdowns (`CONTEXTO.md`, `README.md`) no cofre do Obsidian.

## 10. Rodando pela primeira vez numa máquina nova

```bash
# 1. Garanta que node/npm estão no PATH (ver seção 9 se não tiver)
node -v && npm -v

# 2. Instale as dependências
npm install

# 3. Copie .env.example para .env e preencha o que já tiver
cp .env.example .env

# 4. Crie o banco local
npx prisma migrate dev

# 5. Rode
npm run dev
```

Abra `http://localhost:3000`. Veja `README.md` para detalhes de cada variável
de ambiente e como configurar o Cal.com.

## 11. O que NÃO foi trazido para o export

- `node_modules/` e `.next/` — recriados com `npm install` / `npm run dev`
- `dev.db` (SQLite) — dados de teste locais, não precisa levar; roda
  `prisma migrate dev` de novo e começa vazio
- Não há repositório git neste projeto (não havia Xcode CLT disponível pra
  instalar o `git`) — ao copiar a pasta para a nova máquina, considere
  inicializar um repo (`git init`) lá se quiser versionamento
