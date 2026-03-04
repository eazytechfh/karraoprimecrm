-- Script para corrigir a constraint de estagio_lead para aceitar valores case-insensitive
-- e normalizar todos os valores para minúsculo

-- 1. Remover a constraint existente
ALTER TABLE "BASE_DE_LEADS" DROP CONSTRAINT IF EXISTS "BASE_DE_LEADS_estagio_lead_check";

-- 2. Normalizar todos os valores existentes para minúsculo
UPDATE "BASE_DE_LEADS" SET estagio_lead = LOWER(estagio_lead) WHERE estagio_lead IS NOT NULL;

-- 3. Corrigir valores antigos que podem ter sido inseridos com case diferente
UPDATE "BASE_DE_LEADS" SET estagio_lead = 'novo_lead' 
WHERE LOWER(estagio_lead) IN ('novo_lead', 'novo lead', 'novos_lead', 'oportunidade');

UPDATE "BASE_DE_LEADS" SET estagio_lead = 'em_qualificacao' 
WHERE LOWER(estagio_lead) IN ('em_qualificacao', 'em qualificacao', 'em qualificação', 'qualificacao', 'pesquisa_atendimento');

UPDATE "BASE_DE_LEADS" SET estagio_lead = 'transferido' 
WHERE LOWER(estagio_lead) IN ('transferido', 'em_negociacao', 'em negociacao', 'fechado');

UPDATE "BASE_DE_LEADS" SET estagio_lead = 'follow_up' 
WHERE LOWER(estagio_lead) IN ('follow_up', 'follow up', 'followup', 'nao_fechou', 'não fechou');

-- 4. Definir valor padrão para registros inválidos
UPDATE "BASE_DE_LEADS" SET estagio_lead = 'novo_lead' 
WHERE estagio_lead IS NULL 
   OR LOWER(estagio_lead) NOT IN ('novo_lead', 'em_qualificacao', 'transferido', 'follow_up');

-- 5. Adicionar a nova constraint com CHECK usando LOWER() para aceitar qualquer case
ALTER TABLE "BASE_DE_LEADS" 
ADD CONSTRAINT "BASE_DE_LEADS_estagio_lead_check" 
CHECK (LOWER(estagio_lead) IN ('novo_lead', 'em_qualificacao', 'transferido', 'follow_up'));

-- 6. Criar um trigger para normalizar automaticamente para minúsculo
CREATE OR REPLACE FUNCTION normalize_estagio_lead()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estagio_lead IS NOT NULL THEN
    NEW.estagio_lead := LOWER(NEW.estagio_lead);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS normalize_estagio_lead_trigger ON "BASE_DE_LEADS";

CREATE TRIGGER normalize_estagio_lead_trigger
BEFORE INSERT OR UPDATE ON "BASE_DE_LEADS"
FOR EACH ROW
EXECUTE FUNCTION normalize_estagio_lead();
