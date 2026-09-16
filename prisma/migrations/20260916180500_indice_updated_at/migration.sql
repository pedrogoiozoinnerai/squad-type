-- Índice em `Lead.updatedAt`.
--
-- O CRM passou a espelhar este funil com marca d'água: a cada dez minutos ele
-- pergunta "o que mudou desde a última vez", ordenando por `updatedAt`. Sem o
-- índice essa consulta varre a tabela inteira a cada execução — 144 varreduras
-- por dia sobre uma tabela que cresce 1.000 linhas por dia.
--
-- `updatedAt` e não `createdAt` porque o espelho também precisa pegar quem já
-- existia e MUDOU: remarcou, cancelou, agendou depois.

-- CreateIndex
CREATE INDEX "Lead_updatedAt_idx" ON "Lead"("updatedAt");
