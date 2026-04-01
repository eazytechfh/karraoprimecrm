-- Atualiza os estágios de negociação para o novo funil:
-- pendente; contato_iniciado; nao_responde; em_qualificacao; vendedor; resgate

ALTER TABLE "BASE_DE_LEADS" DROP CONSTRAINT IF EXISTS "BASE_DE_LEADS_estagio_lead_check";
ALTER TABLE "BASE_DE_LEADS" DROP CONSTRAINT IF EXISTS base_de_leads_estagio_lead_check;

UPDATE "BASE_DE_LEADS"
SET estagio_lead = LOWER(estagio_lead)
WHERE estagio_lead IS NOT NULL;

UPDATE "BASE_DE_LEADS"
SET estagio_lead = 'pendente'
WHERE estagio_lead IN ('novo_lead', 'novo lead', 'oportunidade')
   OR estagio_lead IS NULL;

UPDATE "BASE_DE_LEADS"
SET estagio_lead = 'resgate'
WHERE estagio_lead IN ('follow_up', 'follow up', 'resgate');

UPDATE "BASE_DE_LEADS"
SET estagio_lead = 'vendedor'
WHERE estagio_lead IN ('transferido', 'vendedor');

UPDATE "BASE_DE_LEADS"
SET estagio_lead = 'em_qualificacao'
WHERE estagio_lead IN ('em_qualificacao', 'em qualificacao', 'em qualificação');

UPDATE "BASE_DE_LEADS"
SET estagio_lead = 'pendente'
WHERE estagio_lead NOT IN ('pendente', 'contato_iniciado', 'nao_responde', 'em_qualificacao', 'vendedor', 'resgate');

ALTER TABLE "BASE_DE_LEADS"
ADD CONSTRAINT "BASE_DE_LEADS_estagio_lead_check"
CHECK (LOWER(estagio_lead) IN ('pendente', 'contato_iniciado', 'nao_responde', 'em_qualificacao', 'vendedor', 'resgate'));

COMMENT ON CONSTRAINT "BASE_DE_LEADS_estagio_lead_check" ON "BASE_DE_LEADS"
IS 'Funil atualizado: pendente, contato_iniciado, nao_responde, em_qualificacao, vendedor, resgate';
