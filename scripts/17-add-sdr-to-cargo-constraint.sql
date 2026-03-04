-- Script para adicionar 'sdr' como cargo válido na tabela AUTORIZAÇÃO

-- Remover o constraint antigo
ALTER TABLE "AUTORIZAÇÃO" 
DROP CONSTRAINT IF EXISTS "AUTORIZAÇÃO_cargo_check";

-- Adicionar novo constraint incluindo 'sdr'
ALTER TABLE "AUTORIZAÇÃO" 
ADD CONSTRAINT "AUTORIZAÇÃO_cargo_check" 
CHECK (cargo IN ('administrador', 'gestor', 'sdr', 'vendedor', 'convidado'));
