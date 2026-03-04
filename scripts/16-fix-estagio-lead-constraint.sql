-- Script para corrigir a constraint de estagio_lead
-- Primeiro remove a constraint existente, depois atualiza os valores

-- 1. Remover a constraint existente
ALTER TABLE "BASE_DE_LEADS" DROP CONSTRAINT IF EXISTS "BASE_DE_LEADS_estagio_lead_check";

-- 2. Atualizar os valores existentes para os novos estágios
UPDATE "BASE_DE_LEADS" SET estagio_lead = 'novo_lead' WHERE estagio_lead = 'oportunidade';
UPDATE "BASE_DE_LEADS" SET estagio_lead = 'transferido' WHERE estagio_lead IN ('em_negociacao', 'fechado');
UPDATE "BASE_DE_LEADS" SET estagio_lead = 'em_qualificacao' WHERE estagio_lead = 'pesquisa_atendimento';
UPDATE "BASE_DE_LEADS" SET estagio_lead = 'follow_up' WHERE estagio_lead = 'nao_fechou';

-- 3. Atualizar valores NULL ou inválidos para o padrão
UPDATE "BASE_DE_LEADS" SET estagio_lead = 'novo_lead' 
WHERE estagio_lead IS NULL 
   OR estagio_lead NOT IN ('novo_lead', 'em_qualificacao', 'transferido', 'follow_up');

-- 4. Adicionar a nova constraint com os estágios corretos
ALTER TABLE "BASE_DE_LEADS" 
ADD CONSTRAINT "BASE_DE_LEADS_estagio_lead_check" 
CHECK (estagio_lead IN ('novo_lead', 'em_qualificacao', 'transferido', 'follow_up'));
