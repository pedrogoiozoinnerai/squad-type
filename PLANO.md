# Plano — deixar o Type do Squad.com robusto e premium

> Escrito em 2026-09-13, a partir de `analise/01-comparativo-types.md` (nós × Viver de IA),
> `analise/02-ecossistema-crm-dashboard.md` (CRM + Dashboard) e de
> `Dashboard/prompts/PROMPT-TYPE.md` (o que o Dashboard precisa daqui).

**Onde estamos:** o funil está completo e funcionando ponta a ponta em
`localhost:3001`, o build de produção passa, a atribuição de UTM é sólida e o
dado que o Dashboard lê é melhor que o da operação de referência. O que falta não
é funcionalidade — é **credencial, confiabilidade e acabamento**.

Legenda de esforço: 🟢 minutos · 🟡 horas · 🔴 dias.
"Quem": **eu** = executo aqui · **você** = depende de credencial ou decisão sua.

---

## Fase 0 — Higiene (fazer antes de qualquer linha nova)

Nada aqui é opcional, e tudo cabe numa sessão.

| # | O quê | Por quê | Esforço | Quem |
|---|---|---|---|---|
| 0.1 | **`git init` + primeiro commit nos três projetos** | Três aplicações sem histórico. Um `rm -rf` errado hoje custa o projeto inteiro. É a maior fragilidade do ecossistema, e a mais barata de resolver | 🟢 | eu |
| 0.2 | **`prisma generate` no script de build** | Deploy na Vercel quebra sem isso: `src/generated/prisma` está no `.gitignore`. CRM e Dashboard já têm | 🟢 | eu |
| 0.3 | `clean:icloud` + `predev`/`prebuild` | Já existem `node_modules 2` e `.next/dev 2`. É o mesmo script que o CRM e o Dashboard usam | 🟢 | eu |
| 0.4 | Corrigir o **horário dos balões** | Hoje toda mensagem mostra a hora do último render; ao retomar a sessão, todas mostram a hora do recarregamento. Guardar `sentAt` na mensagem e persistir no localStorage | 🟡 | eu |
| 0.5 | Barra de progresso cheia no passo certo | No passo 1 de 8 a barra aparece vazia | 🟢 | eu |
| 0.6 | **Reescrever a copy de abertura** | As duas primeiras mensagens são idênticas, palavra por palavra, às do funil da Viver de IA. É o texto que mais pesa na conversão e hoje é de outra operação | 🟡 | eu + você (tom) |

## Fase 1 — Ir ao ar

Sem estes itens o funil não converte, por mais bonito que esteja.

| # | O quê | Detalhe | Esforço | Quem |
|---|---|---|---|---|
| 1.1 | **Cal.com** | Criar o evento e preencher `NEXT_PUBLIC_CAL_LINK`. Sem isso o passo 8 mostra um aviso no lugar do calendário — o funil não agenda nada | 🟢 | você |
| 1.2 | **Webhook do Cal.com** | `CAL_WEBHOOK_SECRET`. Garante o registro mesmo se o lead fechar a aba | 🟢 | você |
| 1.3 | ~~HubSpot~~ — **descartado em 2026-09-14** | O CRM próprio assumiu o papel. Em contrapartida, o item 2.3 (empurrar o lead para o CRM) virou o caminho único do lead até o time — subiu de prioridade | — | — |
| 1.4 | **Meta Pixel** | `NEXT_PUBLIC_FB_PIXEL_ID` do site principal | 🟢 | você |
| 1.5 | **Postgres único** | Operação coordenada: Type, CRM e Dashboard apontam para a mesma instância no mesmo momento. Neon/Supabase/Railway | 🔴 | eu + você (conta) |
| 1.6 | **Deploy + domínio** | Vercel; definir o subdomínio (sugestão: `type.squad.com`, com `NEXT_PUBLIC_ATTRIBUTION_COOKIE_DOMAIN=.squad.com` para herdar UTM do site principal) | 🟡 | eu + você (DNS) |
| 1.7 | **Jurídico** | `/privacidade` e `/termos` são placeholder, e o funil já grava consentimento apontando para eles | 🟡 | você |

## Fase 2 — Fechar o contrato com o CRM e o Dashboard

É aqui que os três apps deixam de ser três projetos e viram um ecossistema.

| # | O quê | Por quê | Esforço | Quem |
|---|---|---|---|---|
| 2.1 | **Marcar `ABANDONED`** | Hoje nunca é gravado: o Dashboard mostra abandono zero para sempre. Proposta: rota protegida chamada por cron da Vercel, marcando `IN_PROGRESS` sem atualização há **24h** — número documentado, porque ele *é* a métrica | 🟡 | eu |
| 2.2 | **Seed realista** (~300 sessões, 60 dias) | Sem isso não dá para avaliar nenhuma tela do Dashboard. Distribuição de abandono maior em WhatsApp e Cargo, ~25% `COMPLETED`, ~15% `ABANDONED`, `utmSource` nos sete valores que o de-para reconhece | 🟡 | eu |
| 2.3 | **Empurrar o lead para o CRM** | Hoje a importação é manual e *pull*: um lead que agenda às 23h só existe no CRM quando um admin clicar. Virar *push* no momento em que o funil completa | 🟡 | eu |
| 2.4 | **Lead parcial também vale** | O CRM só importa `COMPLETED`. Quem deu nome, WhatsApp e e-mail mas não agendou é lead trabalhável e hoje não chega ao time | 🟡 | eu + você (regra) |
| 2.5 | Congelar o contrato de colunas | Documentar no `README` as 12 colunas que o Dashboard lê e que não podem ser renomeadas sem aviso | 🟢 | eu |

## Fase 3 — Robustez

O que separa "funciona na minha máquina" de "aguenta campanha paga".

| # | O quê | Por quê | Esforço |
|---|---|---|---|
| 3.1 | **Rate limit + anti-spam** nas rotas `/api/leads/*` | Hoje qualquer um injeta lead em massa — e eles entram na base que alimenta CRM e Dashboard. Honeypot + limite por IP; Turnstile se aparecer bot sério | 🟡 |
| 3.2 | **Monitoramento de erro** (Sentry ou equivalente) | Hoje um erro em produção é invisível. O funil de referência tem módulo próprio de error tracking | 🟡 |
| 3.3 | **Testes** | Unitários no que tem regra (DDD → cidade, validações do `funnel.ts`, dedup do agendamento) + um e2e do caminho feliz | 🔴 |
| 3.4 | **CI** (GitHub Actions) | `lint` + `build` + testes a cada push. Só faz sentido depois do 0.1 | 🟡 |
| 3.5 | Backup do Postgres + política de retenção LGPD | Dado pessoal de lead tem prazo; hoje não há regra | 🟡 |
| 3.6 | Healthcheck + logs estruturados | Saber que caiu antes do time de vendas avisar | 🟡 |

## Fase 4 — Premium (onde o funil passa a ganhar do de referência)

Ordenado por impacto em conversão, não por facilidade.

| # | O quê | Por quê | Esforço |
|---|---|---|---|
| 4.1 | **Camada de IA na conversa** | O funil deles **gera** a resposta do bot com IA (com fallback estático); o nosso é roteiro fixo. Nossa `lib/funnel.ts` já é exatamente o fallback que essa camada precisa — é incremento, não reescrita. Personalizar por segmento, cargo e porte muda a sensação de "formulário" para "conversa" | 🔴 |
| 4.2 | **Copy por estado (27 UFs)** | Eles têm texto próprio para cada UF; nós temos 10 cidades + genérico. Barato e aumenta a densidade da personalização | 🟡 |
| 4.3 | **Confirmação por WhatsApp** | O CRM já tem a fila (`SendQueue`) modelada. Lead que recebe confirmação no WhatsApp comparece mais — e o no-show é o custo invisível do funil | 🔴 |
| 4.4 | **Agendamento próprio + Meet** | Eles não usam Cal.com: calendário próprio, link para o Google Agenda e sala própria (`call.viverdeia.ai`). O `Meeting.roomId` do CRM já está reservado para isso. Tira a dependência de terceiro e fecha o ciclo dentro da marca | 🔴 |
| 4.5 | **GTM + Google Ads + LinkedIn + CAPI** | Eles medem em três redes; nós, em nenhuma. A Conversions API (servidor) recupera a conversão que o bloqueio de cookie perde no iOS | 🟡 |
| 4.6 | **Infra de A/B test** | Duas hipóteses já estão na mesa: avatar ilustrado (Waz) × foto humana, e ordem dos passos. Sem infra de teste, é chute | 🔴 |
| 4.7 | **Porte da empresa** como qualificação | Eles perguntam `qtd_colaboradores`; é corte que o closer usa. Sem aumentar o número de passos — combinar com um existente | 🟡 |
| 4.8 | Retomada por link | Hoje a sessão vive no localStorage do navegador. Um link de retomada por e-mail/WhatsApp recupera abandono | 🟡 |
| 4.9 | Acessibilidade e polimento de movimento | Foco visível, navegação por teclado no seletor de cargo, `prefers-reduced-motion` | 🟡 |

---

## A ordem que eu recomendo

1. **Fase 0 inteira** — uma sessão. Sai daqui com git, deploy desbloqueado e os dois defeitos visíveis corrigidos.
2. **1.1 a 1.4** — só depende de você colar quatro valores no `.env`. Com isso o funil converte de verdade.
3. **2.1 + 2.2** — o Dashboard passa a mostrar dado real e você enxerga onde o funil perde gente.
4. **1.5 a 1.7** — publicar.
5. **3.1** antes da primeira campanha paga. O resto da Fase 3 em seguida.
6. **Fase 4** guiada pelo que a tela `/funil` mostrar: otimize o passo onde o dado disser que o lead cai, não o que a intuição disser.

## Decisões que dependem de você

- Subdomínio do funil (`type.squad.com`?) e provedor de Postgres.
- Corte de tempo para `ABANDONED` — proponho 24h.
- Lead parcial (nome + WhatsApp + e-mail, sem agendar) entra no CRM? Proponho que sim, com etiqueta de origem.
- Trocar o Cal.com por agendamento próprio faz parte do escopo do Meet ou é projeto do Type?
- Avatar: manter o Waz ou testar foto de alguém do time?
