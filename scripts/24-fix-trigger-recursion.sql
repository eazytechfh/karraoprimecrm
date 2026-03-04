-- Script para corrigir recursão infinita nos triggers
-- Remove os triggers problemáticos e recria com proteção contra loop

-- 1. Primeiro, remover TODOS os triggers existentes que podem causar loop
DROP TRIGGER IF EXISTS trigger_create_agendamento_on_transferido ON "BASE_DE_LEADS";
DROP TRIGGER IF EXISTS trigger_sync_agendamento_to_lead ON "AGENDAMENTOS";
DROP TRIGGER IF EXISTS trigger_sync_lead_to_agendamento ON "BASE_DE_LEADS";

-- 2. Remover as funções antigas
DROP FUNCTION IF EXISTS create_agendamento_on_transferido() CASCADE;
DROP FUNCTION IF EXISTS sync_agendamento_to_lead() CASCADE;
DROP FUNCTION IF EXISTS sync_lead_to_agendamento() CASCADE;

-- 3. Criar função para criar agendamento quando lead é transferido (SEM recursão)
CREATE OR REPLACE FUNCTION create_agendamento_on_transferido()
RETURNS TRIGGER AS $$
BEGIN
  -- Só executa se o estágio mudou para 'transferido'
  IF (TG_OP = 'UPDATE' AND LOWER(NEW.estagio_lead) = 'transferido' AND 
      (OLD.estagio_lead IS NULL OR LOWER(OLD.estagio_lead) != 'transferido')) THEN
    
    -- Verifica se já existe um agendamento para este lead
    IF NOT EXISTS (SELECT 1 FROM "AGENDAMENTOS" WHERE id_lead = NEW.id) THEN
      -- Cria o agendamento sem acionar outros triggers
      INSERT INTO "AGENDAMENTOS" (
        nome_lead,
        telefone,
        email,
        modelo_veiculo,
        observacoes,
        estagio,
        data_criacao,
        id_lead,
        sdr_responsavel,
        id_empresa
      ) VALUES (
        NEW.nome_lead,
        NEW.telefone,
        NEW.email,
        NEW.veiculo_interesse,
        NEW.observacao_vendedor,
        'agendar',
        NOW(),
        NEW.id,
        NEW.sdr_responsavel,
        NEW.id_empresa
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar função de sincronização AGENDAMENTOS -> BASE_DE_LEADS (com proteção)
CREATE OR REPLACE FUNCTION sync_agendamento_to_lead()
RETURNS TRIGGER AS $$
DECLARE
  v_lead_id INTEGER;
BEGIN
  -- Pega o id_lead do agendamento
  v_lead_id := NEW.id_lead;
  
  -- Só sincroniza se tiver id_lead vinculado e se houve mudança real nos campos
  IF v_lead_id IS NOT NULL THEN
    -- Verifica se realmente houve mudança nos campos relevantes
    IF (OLD.nome_lead IS DISTINCT FROM NEW.nome_lead OR
        OLD.telefone IS DISTINCT FROM NEW.telefone OR
        OLD.email IS DISTINCT FROM NEW.email OR
        OLD.modelo_veiculo IS DISTINCT FROM NEW.modelo_veiculo) THEN
      
      -- Atualiza o lead SEM acionar o trigger de volta (usando flag de sessão)
      UPDATE "BASE_DE_LEADS"
      SET 
        nome_lead = NEW.nome_lead,
        telefone = NEW.telefone,
        email = NEW.email,
        veiculo_interesse = NEW.modelo_veiculo
      WHERE id = v_lead_id
        AND (nome_lead IS DISTINCT FROM NEW.nome_lead OR
             telefone IS DISTINCT FROM NEW.telefone OR
             email IS DISTINCT FROM NEW.email OR
             veiculo_interesse IS DISTINCT FROM NEW.modelo_veiculo);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar função de sincronização BASE_DE_LEADS -> AGENDAMENTOS (com proteção)
CREATE OR REPLACE FUNCTION sync_lead_to_agendamento()
RETURNS TRIGGER AS $$
BEGIN
  -- Não executa se está mudando para transferido (evita conflito com outro trigger)
  IF (LOWER(NEW.estagio_lead) = 'transferido' AND 
      (OLD.estagio_lead IS NULL OR LOWER(OLD.estagio_lead) != 'transferido')) THEN
    RETURN NEW;
  END IF;
  
  -- Só sincroniza se houve mudança real nos campos relevantes
  IF (OLD.nome_lead IS DISTINCT FROM NEW.nome_lead OR
      OLD.telefone IS DISTINCT FROM NEW.telefone OR
      OLD.email IS DISTINCT FROM NEW.email OR
      OLD.veiculo_interesse IS DISTINCT FROM NEW.veiculo_interesse) THEN
    
    -- Atualiza os agendamentos vinculados
    UPDATE "AGENDAMENTOS"
    SET 
      nome_lead = NEW.nome_lead,
      telefone = NEW.telefone,
      email = NEW.email,
      modelo_veiculo = NEW.veiculo_interesse
    WHERE id_lead = NEW.id
      AND (nome_lead IS DISTINCT FROM NEW.nome_lead OR
           telefone IS DISTINCT FROM NEW.telefone OR
           email IS DISTINCT FROM NEW.email OR
           modelo_veiculo IS DISTINCT FROM NEW.veiculo_interesse);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar os triggers na ordem correta

-- Trigger para criar agendamento (executa ANTES dos outros)
CREATE TRIGGER trigger_create_agendamento_on_transferido
  AFTER UPDATE ON "BASE_DE_LEADS"
  FOR EACH ROW
  EXECUTE FUNCTION create_agendamento_on_transferido();

-- Trigger de sincronização AGENDAMENTOS -> BASE_DE_LEADS
CREATE TRIGGER trigger_sync_agendamento_to_lead
  AFTER UPDATE ON "AGENDAMENTOS"
  FOR EACH ROW
  WHEN (pg_trigger_depth() < 1)
  EXECUTE FUNCTION sync_agendamento_to_lead();

-- Trigger de sincronização BASE_DE_LEADS -> AGENDAMENTOS
CREATE TRIGGER trigger_sync_lead_to_agendamento
  AFTER UPDATE ON "BASE_DE_LEADS"
  FOR EACH ROW
  WHEN (pg_trigger_depth() < 1)
  EXECUTE FUNCTION sync_lead_to_agendamento();
