-- Atualiza os valores existentes para os novos estágios
-- Mapeamento:
-- oportunidade -> novo_lead
-- em_negociacao -> transferido
-- pesquisa_atendimento -> em_qualificacao
-- em_qualificacao -> em_qualificacao (mantém)
-- follow_up -> follow_up (mantém)
-- fechado -> transferido
-- nao_fechou -> follow_up

-- 1. Atualizar os valores existentes
UPDATE "BASE_DE_LEADS"
SET estagio_lead = 'novo_lead'
WHERE estagio_lead = 'oportunidade';

UPDATE "BASE_DE_LEADS"
SET estagio_lead = 'transferido'
WHERE estagio_lead IN ('em_negociacao', 'fechado');

UPDATE "BASE_DE_LEADS"
SET estagio_lead = 'em_qualificacao'
WHERE estagio_lead = 'pesquisa_atendimento';

UPDATE "BASE_DE_LEADS"
SET estagio_lead = 'follow_up'
WHERE estagio_lead = 'nao_fechou';

-- 2. Remover a constraint antiga (se existir)
DO $$ 
BEGIN
    -- Tenta remover constraints que possam existir
    ALTER TABLE "BASE_DE_LEADS" DROP CONSTRAINT IF EXISTS "BASE_DE_LEADS_estagio_lead_check";
    ALTER TABLE "BASE_DE_LEADS" DROP CONSTRAINT IF EXISTS base_de_leads_estagio_lead_check;
EXCEPTION WHEN OTHERS THEN
    -- Ignora erros se a constraint não existir
    NULL;
END $$;

-- 3. Adicionar a nova constraint com os valores corretos
ALTER TABLE "BASE_DE_LEADS" 
ADD CONSTRAINT "BASE_DE_LEADS_estagio_lead_check" 
CHECK (estagio_lead IN ('novo_lead', 'em_qualificacao', 'transferido', 'follow_up'));
