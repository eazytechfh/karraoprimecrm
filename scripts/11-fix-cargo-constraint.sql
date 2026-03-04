-- Script para corrigir o constraint de cargo na tabela AUTORIZAÇÃO
-- Adicionando 'gestor' como valor válido

-- Remover o constraint antigo
ALTER TABLE "AUTORIZAÇÃO" 
DROP CONSTRAINT IF EXISTS "AUTORIZAÇÃO_cargo_check";

-- Adicionar novo constraint com mais opções de cargo
ALTER TABLE "AUTORIZAÇÃO" 
ADD CONSTRAINT "AUTORIZAÇÃO_cargo_check" 
CHECK (cargo IN ('administrador', 'gestor', 'vendedor', 'convidado'));

-- Atualizar registros existentes que possam ter valores inválidos
UPDATE "AUTORIZAÇÃO" 
SET cargo = 'administrador' 
WHERE cargo IS NULL OR cargo NOT IN ('administrador', 'gestor', 'vendedor', 'convidado');
