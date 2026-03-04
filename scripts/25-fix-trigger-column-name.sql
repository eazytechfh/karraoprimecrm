-- Fix trigger recursion with correct column names
-- First, drop all existing triggers that might cause issues
DROP TRIGGER IF EXISTS on_lead_transferido ON "BASE_DE_LEADS";
DROP TRIGGER IF EXISTS sync_agendamentos_to_leads_trigger ON "AGENDAMENTOS";
DROP TRIGGER IF EXISTS sync_leads_to_agendamentos_trigger ON "BASE_DE_LEADS";

-- Drop existing functions
DROP FUNCTION IF EXISTS create_agendamento_on_transferido() CASCADE;
DROP FUNCTION IF EXISTS sync_agendamentos_to_leads() CASCADE;
DROP FUNCTION IF EXISTS sync_leads_to_agendamentos() CASCADE;

-- Function to create agendamento when lead is moved to transferido
-- This function uses pg_trigger_depth() to prevent recursive calls
CREATE OR REPLACE FUNCTION create_agendamento_on_transferido()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if this is NOT being called by another trigger
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  
  -- Check if estagio_lead changed to 'transferido'
  IF LOWER(NEW.estagio_lead) = 'transferido' AND 
     (OLD.estagio_lead IS NULL OR LOWER(OLD.estagio_lead) != 'transferido') THEN
    
    -- Check if agendamento already exists for this lead
    IF NOT EXISTS (
      SELECT 1 FROM "AGENDAMENTOS" 
      WHERE id_lead = NEW.id
    ) THEN
      -- Create new agendamento
      INSERT INTO "AGENDAMENTOS" (
        id_empresa,
        id_lead,
        nome_lead,
        telefone,
        email,
        modelo_veiculo,
        observacoes,
        vendedor,
        estagio_agendamento,
        sdr_responsavel,
        created_at,
        updated_at
      ) VALUES (
        NEW.id_empresa,
        NEW.id,
        NEW.nome_lead,
        NEW.telefone,
        NEW.email,
        NEW.veiculo_interesse,
        NEW.observacao_vendedor,
        NEW.vendedor,
        'agendar',
        NEW.sdr_responsavel,
        NOW(),
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync changes from AGENDAMENTOS to BASE_DE_LEADS
CREATE OR REPLACE FUNCTION sync_agendamentos_to_leads()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if this is NOT being called by another trigger
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  
  -- Only sync if id_lead is set and there are actual changes
  IF NEW.id_lead IS NOT NULL THEN
    -- Check if any syncable field actually changed
    IF (NEW.nome_lead IS DISTINCT FROM OLD.nome_lead) OR
       (NEW.telefone IS DISTINCT FROM OLD.telefone) OR
       (NEW.email IS DISTINCT FROM OLD.email) OR
       (NEW.modelo_veiculo IS DISTINCT FROM OLD.modelo_veiculo) OR
       (NEW.observacoes IS DISTINCT FROM OLD.observacoes) THEN
      
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to sync changes from BASE_DE_LEADS to AGENDAMENTOS
CREATE OR REPLACE FUNCTION sync_leads_to_agendamentos()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if this is NOT being called by another trigger
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  
  -- Skip if moving to transferido (handled by other trigger)
  IF LOWER(NEW.estagio_lead) = 'transferido' AND 
     (OLD.estagio_lead IS NULL OR LOWER(OLD.estagio_lead) != 'transferido') THEN
    RETURN NEW;
  END IF;
  
  -- Check if any syncable field actually changed
  IF (NEW.nome_lead IS DISTINCT FROM OLD.nome_lead) OR
     (NEW.telefone IS DISTINCT FROM OLD.telefone) OR
     (NEW.email IS DISTINCT FROM OLD.email) OR
     (NEW.veiculo_interesse IS DISTINCT FROM OLD.veiculo_interesse) OR
     (NEW.observacao_vendedor IS DISTINCT FROM OLD.observacao_vendedor) THEN
    
    UPDATE "AGENDAMENTOS"
    SET 
      nome_lead = COALESCE(NEW.nome_lead, nome_lead),
      telefone = COALESCE(NEW.telefone, telefone),
      email = COALESCE(NEW.email, email),
      modelo_veiculo = COALESCE(NEW.veiculo_interesse, modelo_veiculo),
      observacoes = COALESCE(NEW.observacao_vendedor, observacoes),
      updated_at = NOW()
    WHERE id_lead = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-creating agendamento when lead moves to transferido
CREATE TRIGGER on_lead_transferido
  AFTER UPDATE ON "BASE_DE_LEADS"
  FOR EACH ROW
  EXECUTE FUNCTION create_agendamento_on_transferido();

-- Create trigger for syncing from AGENDAMENTOS to BASE_DE_LEADS
CREATE TRIGGER sync_agendamentos_to_leads_trigger
  AFTER UPDATE ON "AGENDAMENTOS"
  FOR EACH ROW
  EXECUTE FUNCTION sync_agendamentos_to_leads();

-- Create trigger for syncing from BASE_DE_LEADS to AGENDAMENTOS
CREATE TRIGGER sync_leads_to_agendamentos_trigger
  AFTER UPDATE ON "BASE_DE_LEADS"
  FOR EACH ROW
  EXECUTE FUNCTION sync_leads_to_agendamentos();
