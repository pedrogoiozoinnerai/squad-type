# Comparativo — Type Squad.com × Type Viver de IA

> Escrito em 2026-09-13. O "Type deles" é `type.viverdeia.ai`, o funil que serviu
> de referência para este projeto (ver `CONTEXTO.md`, seção 1).

## Método (o que é observado e o que é inferido)

Analisei o funil deles ao vivo: DOM, CSS computado, requisições de rede e os
nomes/conteúdo dos chunks JavaScript que o site carrega. **Não preenchi o
formulário deles** — submeter dados falsos criaria lead sujo no CRM de terceiro.
Então: a primeira tela é observação direta; os passos 2 a 8 são inferidos do
bundle (nomes de módulo, strings de copy, endpoints). Onde é inferência, está
marcado com ⚠.

## 1. Stack

| | **Squad.com (nosso)** | **Viver de IA (referência)** |
|---|---|---|
| Front | Next.js 16 App Router, React 19 | Vite + React SPA (sem SSR) |
| Back | API Routes no mesmo app | Supabase (`qcijtwtmdjtjnodwkafg.supabase.co`) + Edge Functions |
| Banco | Prisma 7 / SQLite → Postgres | Postgres do Supabase |
| Fonte | Fustat | Nunito Sans |
| Deploy | ainda não publicado | publicado, assets versionados por hash |

**Leitura:** a escolha deles é clássica de time que quer velocidade (SPA +
BaaS). A nossa é melhor para o que viemos fazer: o funil, o CRM e o Dashboard
compartilham a **mesma instância de Postgres**, então o dado nasce integrado em
vez de precisar de sincronização. O preço é que somos responsáveis pelo backend.

## 2. Identidade visual

| | **Nosso** | **Deles** |
|---|---|---|
| Fundo | off-white `#faf9f7` com textura pontilhada | navy escuro `#02162c` |
| Acento | verde Waz `#2dc86a` | branco sobre navy |
| Avatar | ilustração do Waz (personagem da marca) | **foto de uma pessoa real** |
| Cabeçalho | barra verde estilo "conversa aberta" do WhatsApp: avatar + nome + "Waz está te atendendo · passo 1 de 8" + barra de progresso | logo no canto, stepper de bolinhas, contador "0 de 8" grande |
| Balões | com horário e check duplo (cinza → azul) | balões limpos, sem horário |

**Leitura:** são duas apostas diferentes e a nossa é mais forte para o Brasil.
Eles fazem "formulário bonito". Nós fazemos **conversa de WhatsApp** — e o
brasileiro já sabe operar essa interface sem instrução. O avatar deles ser uma
foto humana é um ponto real a considerar: rosto humano converte mais que
ilustração em topo de funil. Vale testar (A/B) o Waz contra uma foto de alguém
do time.

## 3. Copy — o ponto mais urgente

As duas primeiras mensagens do nosso bot são **idênticas, palavra por palavra**,
às deles:

> "Empresas que aplicam IA da forma certa estão reduzindo custos em até 40% e
> aumentando receita sem aumentar time…" / "Então bora começar! Qual seu nome?"

Isso foi herdado quando o funil foi desenhado a partir da referência. Precisa ser
reescrito antes de ir ao ar: é a primeira coisa que o lead lê, é o texto que mais
importa para conversão, e hoje ele é o texto de outra operação.

## 4. Personalização — onde eles estão claramente à frente

O bundle deles carrega três módulos que nós não temos:

- **`use-ai-chat`** ⚠ — chama uma função de IA (`ai-chat-response`) para gerar a
  resposta do bot, com fallback estático quando a IA falha ("AI returned
  fallback"). Ou seja: a conversa deles é **gerada**, não roteirizada.
- **`use-lead-context`** ⚠ — monta o contexto do lead com `urgency_level`,
  `formality_level`, se o cargo é decisor, `qtd_colaboradores` e o `utm_medium`.
  É o que alimenta a IA acima.
- **`state-messages`** ⚠ — copy por **estado** (as 27 UFs), não por cidade:
  *"Sergipe, mercado ágil e empresário resolvido. IA aqui vira margem em meses,
  não em anos."*

Além disso: saudação por período do dia ("Boa tarde"/"Boa noite") e detecção de
mobile/tablet/desktop.

**Nosso hoje:** copy 100% estática, com duas ramificações — 10 cidades com texto
próprio (+ fallback genérico para os outros DDDs) e decisor × não-decisor.

**A boa notícia:** a arquitetura para virar o jogo já existe aqui. Nossa camada
estática de `src/lib/funnel.ts` é exatamente o *fallback* que uma camada de IA
precisa ter. Plugar geração por IA por cima dela é incremental, não reescrita.

## 5. Passos do funil

Ambos têm **8 passos**. Diferenças que apareceram:

| | Nosso | Deles |
|---|---|---|
| Telefone | só Brasil (+55 fixo) | seletor internacional (`phone-countries`) ⚠ |
| Tamanho da empresa | não perguntamos | `qtd_colaboradores` ⚠ |
| Faturamento | 7 faixas | tem faixas também ⚠ |
| Agendamento | embed do Cal.com (terceiro) | **calendário próprio** (`InlineCalendar`) ⚠ |

`qtd_colaboradores` é um dado de qualificação que o closer usa e que o Dashboard
poderia cortar. Vale avaliar trocar ou somar a um passo existente — mas **sem
aumentar o número de passos**, que já é longo.

## 6. Agendamento e pós-agendamento

O bundle deles referencia `https://call.viverdeia.ai/call/` e
`calendar.google.com/calendar/render`. Ou seja: o lead agenda no calendário
**deles**, recebe link para adicionar no Google Agenda e cai numa **sala de
reunião própria** — sem Cal.com, sem Zoom, sem Meet.

Nós hoje dependemos do Cal.com (e ele ainda nem está configurado). O caminho
premium é o mesmo deles, e o ecossistema já está preparado: o `Meeting.roomId`
do CRM existe e está vazio justamente esperando o projeto do Meet.

## 7. Rastreamento

| | Nosso | Deles |
|---|---|---|
| Meta Pixel | código pronto, **sem ID configurado** | ativo (`961167295374175`) |
| Google Tag Manager | não existe | **dois contêineres** (GTM-M4S9MKRG, GTM-KTJZBJMS) |
| Google Ads | não existe | conversão ativa (AW-17292837699) |
| LinkedIn Insight | não existe | ativo |
| Erro em produção | **não existe** | módulo `error-tracking` ⚠ |
| Conversions API (servidor) | não existe | não identificado |
| UTM que sobrevive à navegação | ✅ cookie próprio, 90 dias | não identificado |

Eles estão medindo mídia paga em três redes; nós, em nenhuma. Por outro lado, a
nossa atribuição por cookie é sólida e foi testada.

## 8. Onde nós já somos melhores

1. **Dado de abandono exato.** `currentStep` grava onde a pessoa parou, e o
   Dashboard lê isso direto do banco. O dashboard de referência estima abandono
   por evento de GA4 — aproximação. O nosso é contagem.
2. **Trilha de auditoria.** `LeadEvent` guarda cada resposta enviada. Não existe
   equivalente visível no deles.
3. **Integração nativa com CRM.** O lead do funil vira lead do CRM por
   `typeLeadId`/`typeSessionId`, idempotente. Não há importação manual de CSV.
4. **Acessibilidade básica.** A página deles declara `lang="en"` num site
   inteiramente em português — leitor de tela lê com fonética errada. A nossa
   declara `pt-BR`.
5. **Resiliência de rede** — nosso cliente só re-tenta em 5xx/rede (4xx não
   adianta). Eles têm `rpc-retry`; empate técnico.

## 9. Defeitos reais encontrados no nosso (verificados no código)

| # | Problema | Onde | Efeito |
|---|---|---|---|
| 1 | Horário do balão é calculado **no render** (`new Date()` dentro do componente) | `components/funnel/ChatBubble.tsx` | Toda mensagem mostra a hora do último render, não a de envio. Sessão retomada mostra todos os balões com a hora do recarregamento. |
| 2 | `ABANDONED` nunca é gravado | não existe no código — só no enum | Dashboard mostra "abandonados: 0" para sempre; sessão antiga fica "em andamento" eternamente |
| 3 | `build` não roda `prisma generate` | `package.json` | **Deploy na Vercel quebra**: `src/generated/prisma` está no `.gitignore`. CRM e Dashboard já corrigiram isso |
| 4 | Barra de progresso enche `stepIndex/(total-1)` | `ProgressBar.tsx` | No passo 1 de 8 a barra aparece vazia (0%) |
| 5 | Sem rate limit nas rotas `/api/leads/*` | todas | Qualquer um pode injetar lead em massa — e esses leads vão para o HubSpot |
| 6 | Sem `prisma/seed.ts` | — | Impossível avaliar a tela `/funil` do Dashboard (6 sessões, todas no passo 1) |
| 7 | Sem repositório git | os **três** projetos | Nenhum histórico, nenhum rollback, nenhum CI |
| 8 | Sem `clean:icloud` | `package.json` | Já existem `node_modules 2` e `.next/dev 2` no projeto (CRM e Dashboard têm o script) |
| 9 | Nenhum teste | — | Nada trava uma regressão no DDD, na validação ou no fluxo |
| 10 | `chatLog` no localStorage não guarda horário | `lib/session.ts` | Consequência do #1: não há como restaurar o horário real |

O build de produção passa (`npm run build` ✓, TypeScript ✓) — o projeto está
saudável; os itens acima são lacunas, não quebras.
