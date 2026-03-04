-- Script para corrigir o trigger de transferido com CASCADE
-- Primeiro remove o trigger, depois a função

-- Remove o trigger se existir
DROP TRIGGER IF EXISTS trigger_create_agendamento_on_transferido ON "BASE_DE_LEADS";

-- Remove a função com CASCADE para forçar remoção de dependências
DROP FUNCTION IF EXISTS create_agendamento_on_transferido() CASCADE;

-- Cria a função que será executada pelo trigger
CREATE OR REPLACE FUNCTION create_agendamento_on_transferido()
RETURNS TRIGGER AS $$
BEGIN
  -- Verifica se o estagio_lead foi alterado para 'transferido' (case insensitive)
  IF LOWER(NEW.estagio_lead) = 'transferido' AND 
     (OLD.estagio_lead IS NULL OR LOWER(OLD.estagio_lead) != 'transferido') THEN
    
    -- Verifica se já existe um agendamento para este lead
    IF NOT EXISTS (
      SELECT 1 FROM "AGENDAMENTOS" 
      WHERE lead_id = NEW.id
    ) THEN
      -- Cria o agendamento automaticamente
      INSERT INTO "AGENDAMENTOS" (
        lead_id,
        nome_lead,
        telefone,
        email,
        veiculo_interesse,
        observacoes,
        estagio,
        sdr_responsavel,
        data_criacao,
        id_empresa
      ) VALUES (
        NEW.id,
        NEW.nome_lead,
        NEW.telefone_lead,
        NEW.email_lead,
        NEW.veiculo_interesse,
        NEW.observacao_vendedor,
        'agendar',
        NEW.sdr_responsavel,
        NOW(),
        NEW.id_empresa
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria o trigger na tabela BASE_DE_LEADS
CREATE TRIGGER trigger_create_agendamento_on_transferido
  AFTER UPDATE OF estagio_lead ON "BASE_DE_LEADS"
  FOR EACH ROW
  EXECUTE FUNCTION create_agendamento_on_transferido();

-- Comentário para documentação
COMMENT ON FUNCTION create_agendamento_on_transferido() IS 
  'Função que cria automaticamente um agendamento quando um lead é movido para a etapa transferido';
