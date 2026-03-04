-- Script para adicionar coluna sdr_responsavel nas tabelas
-- Isso permite que cada lead/agendamento seja direcionado para um SDR específico

-- Adicionar coluna sdr_responsavel na tabela BASE_DE_LEADS
ALTER TABLE "BASE_DE_LEADS" 
ADD COLUMN IF NOT EXISTS sdr_responsavel VARCHAR(255);

-- Adicionar coluna sdr_responsavel na tabela AGENDAMENTOS  
ALTER TABLE "AGENDAMENTOS"
ADD COLUMN IF NOT EXISTS sdr_responsavel VARCHAR(255);

-- Criar índices para melhorar performance das buscas
CREATE INDEX IF NOT EXISTS idx_leads_sdr_responsavel ON "BASE_DE_LEADS" (sdr_responsavel);
CREATE INDEX IF NOT EXISTS idx_agendamentos_sdr_responsavel ON "AGENDAMENTOS" (sdr_responsavel);
