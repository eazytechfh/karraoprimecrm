-- Trigger para criar agendamento automaticamente quando lead é movido para "transferido"
-- Funciona tanto para atualizações do frontend quanto de automações externas

-- Primeiro, criar a função que será executada pelo trigger
CREATE OR REPLACE FUNCTION create_agendamento_on_transferido()
RETURNS TRIGGER AS $$
DECLARE
  agendamento_existente INTEGER;
BEGIN
  -- Verificar se o estágio foi alterado para 'transferido'
  IF NEW.estagio_lead = 'transferido' AND (OLD.estagio_lead IS NULL OR OLD.estagio_lead != 'transferido') THEN
    
    -- Verificar se já existe um agendamento para este lead (evitar duplicatas)
    SELECT COUNT(*) INTO agendamento_existente
    FROM "AGENDAMENTOS"
    WHERE lead_id = NEW.id;
    
    -- Se não existir agendamento, criar um novo
    IF agendamento_existente = 0 THEN
      INSERT INTO "AGENDAMENTOS" (
        lead_id,
        nome,
        telefone,
        email,
        veiculo_interesse,
        observacoes,
        estagio,
        data_criacao,
        sdr_responsavel,
        id_empresa
      ) VALUES (
        NEW.id,
        COALESCE(NEW.nome_lead, 'Lead sem nome'),
        NEW.telefone,
        NEW.email,
        NEW.veiculo_interesse,
        NEW.observacao_vendedor,
        'agendar',
        NOW(),
        NEW.sdr_responsavel,
        NEW.id_empresa
      );
      
      RAISE NOTICE 'Agendamento criado automaticamente para lead ID: %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_create_agendamento_on_transferido ON "BASE_DE_LEADS";

-- Criar o trigger na tabela BASE_DE_LEADS
CREATE TRIGGER trigger_create_agendamento_on_transferido
  AFTER UPDATE OF estagio_lead ON "BASE_DE_LEADS"
  FOR EACH ROW
  EXECUTE FUNCTION create_agendamento_on_transferido();

-- Também criar trigger para INSERT (caso um lead já seja criado com estágio 'transferido')
DROP TRIGGER IF EXISTS trigger_create_agendamento_on_insert_transferido ON "BASE_DE_LEADS";

CREATE TRIGGER trigger_create_agendamento_on_insert_transferido
  AFTER INSERT ON "BASE_DE_LEADS"
  FOR EACH ROW
  WHEN (NEW.estagio_lead = 'transferido')
  EXECUTE FUNCTION create_agendamento_on_transferido();

-- Comentário explicativo
COMMENT ON FUNCTION create_agendamento_on_transferido() IS 
'Função trigger que cria automaticamente um agendamento na tabela AGENDAMENTOS quando um lead é movido para o estágio transferido. Funciona para atualizações do frontend e automações externas.';
