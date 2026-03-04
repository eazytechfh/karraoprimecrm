-- Adiciona coluna motivo_perda na tabela AGENDAMENTOS
ALTER TABLE "AGENDAMENTOS" ADD COLUMN IF NOT EXISTS motivo_perda character varying;

-- Adiciona coluna data_perda para registrar quando foi perdido
ALTER TABLE "AGENDAMENTOS" ADD COLUMN IF NOT EXISTS data_perda date;
