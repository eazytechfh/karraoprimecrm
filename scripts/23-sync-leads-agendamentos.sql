-- Script para sincronizar dados entre BASE_DE_LEADS e AGENDAMENTOS
-- Quando um campo é alterado em uma tabela, ele automaticamente atualiza a outra

-- =============================================
-- TRIGGER: AGENDAMENTOS -> BASE_DE_LEADS
-- Quando alterar dados no agendamento, atualiza o lead original
-- =============================================

CREATE OR REPLACE FUNCTION sync_agendamento_to_lead()
RETURNS TRIGGER AS $$
BEGIN
  -- Só sincroniza se existir um id_lead vinculado
  IF NEW.id_lead IS NOT NULL THEN
    UPDATE "BASE_DE_LEADS"
    SET
      nome_lead = COALESCE(NEW.nome_lead, nome_lead),
      telefone = COALESCE(NEW.telefone, telefone),
      email = COALESCE(NEW.email, email),
      veiculo_interesse = COALESCE(NEW.modelo_veiculo, veiculo_interesse),
      observacao_vendedor = COALESCE(NEW.observacoes, observacao_vendedor),
      updated_at = NOW()
    WHERE id = NEW.id_lead;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_sync_agendamento_to_lead ON "AGENDAMENTOS";

-- Cria o trigger
CREATE TRIGGER trigger_sync_agendamento_to_lead
AFTER UPDATE ON "AGENDAMENTOS"
FOR EACH ROW
EXECUTE FUNCTION sync_agendamento_to_lead();

-- =============================================
-- TRIGGER: BASE_DE_LEADS -> AGENDAMENTOS
-- Quando alterar dados no lead, atualiza o agendamento vinculado
-- =============================================

CREATE OR REPLACE FUNCTION sync_lead_to_agendamento()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualiza todos os agendamentos vinculados a este lead
  UPDATE "AGENDAMENTOS"
  SET
    nome_lead = COALESCE(NEW.nome_lead, nome_lead),
    telefone = COALESCE(NEW.telefone, telefone),
    email = COALESCE(NEW.email, email),
    modelo_veiculo = COALESCE(NEW.veiculo_interesse, modelo_veiculo),
    observacoes = COALESCE(NEW.observacao_vendedor, observacoes),
    updated_at = NOW()
  WHERE id_lead = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_sync_lead_to_agendamento ON "BASE_DE_LEADS";

-- Cria o trigger
CREATE TRIGGER trigger_sync_lead_to_agendamento
AFTER UPDATE ON "BASE_DE_LEADS"
FOR EACH ROW
EXECUTE FUNCTION sync_lead_to_agendamento();

-- =============================================
-- Verifica e corrige id_lead nos agendamentos existentes
-- Tenta vincular pelo telefone se id_lead estiver nulo
-- =============================================

UPDATE "AGENDAMENTOS" a
SET id_lead = (
  SELECT id FROM "BASE_DE_LEADS" b 
  WHERE b.telefone = a.telefone 
  AND b.id_empresa = a.id_empresa
  LIMIT 1
)
WHERE a.id_lead IS NULL;

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE 'Sincronização bidirecional configurada com sucesso!';
  RAISE NOTICE 'Campos sincronizados: nome, telefone, email, veículo de interesse, observações';
END $$;
