-- Garante que todo lead na etapa vendedor, com vendedor atribuido, tenha um
-- agendamento vinculado. O script e idempotente. Uma nova entrada em Vendedor
-- abre um novo ciclo em Agendar; sincronizacoes posteriores preservam a etapa.

CREATE OR REPLACE FUNCTION sync_vendedor_lead_to_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  existing_agendamento_id BIGINT;
  existing_stage TEXT;
  entered_vendedor BOOLEAN;
BEGIN
  IF LOWER(COALESCE(NEW.estagio_lead, '')) <> 'vendedor'
     OR NULLIF(TRIM(COALESCE(NEW.vendedor, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;

  entered_vendedor :=
    TG_OP = 'INSERT'
    OR LOWER(COALESCE(OLD.estagio_lead, '')) <> 'vendedor';

  SELECT id, LOWER(COALESCE(estagio_agendamento, 'agendar'))
    INTO existing_agendamento_id, existing_stage
  FROM "AGENDAMENTOS"
  WHERE id_empresa = NEW.id_empresa
    AND id_lead = NEW.id
  ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
  LIMIT 1;

  IF existing_agendamento_id IS NULL THEN
    INSERT INTO "AGENDAMENTOS" (
      id_empresa,
      id_lead,
      nome_lead,
      telefone,
      email,
      modelo_veiculo,
      vendedor,
      sdr_responsavel,
      estagio_agendamento,
      observacoes,
      created_at,
      updated_at
    ) VALUES (
      NEW.id_empresa,
      NEW.id,
      COALESCE(NULLIF(TRIM(NEW.nome_lead), ''), 'Lead sem nome'),
      NEW.telefone,
      NEW.email,
      NEW.veiculo_interesse,
      NEW.vendedor,
      NEW.sdr_responsavel,
      'agendar',
      NEW.observacao_vendedor,
      NOW(),
      NOW()
    );
  ELSE
    UPDATE "AGENDAMENTOS"
    SET vendedor = NEW.vendedor,
        sdr_responsavel = COALESCE(NEW.sdr_responsavel, sdr_responsavel),
        estagio_agendamento = CASE
          WHEN entered_vendedor THEN 'agendar'
          ELSE estagio_agendamento
        END,
        updated_at = NOW()
    WHERE id = existing_agendamento_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_vendedor_lead_to_agendamento_trigger ON "BASE_DE_LEADS";

CREATE TRIGGER sync_vendedor_lead_to_agendamento_trigger
AFTER INSERT OR UPDATE OF estagio_lead, vendedor, sdr_responsavel
ON "BASE_DE_LEADS"
FOR EACH ROW
EXECUTE FUNCTION sync_vendedor_lead_to_agendamento();

-- Reconcilia somente leads sem nenhum agendamento. Nao altera resultados
-- existentes nem cria duplicatas para leads que ja possuam vinculo.
INSERT INTO "AGENDAMENTOS" (
  id_empresa,
  id_lead,
  nome_lead,
  telefone,
  email,
  modelo_veiculo,
  vendedor,
  sdr_responsavel,
  estagio_agendamento,
  observacoes,
  created_at,
  updated_at
)
SELECT
  lead.id_empresa,
  lead.id,
  COALESCE(NULLIF(TRIM(lead.nome_lead), ''), 'Lead sem nome'),
  lead.telefone,
  lead.email,
  lead.veiculo_interesse,
  lead.vendedor,
  lead.sdr_responsavel,
  'agendar',
  lead.observacao_vendedor,
  NOW(),
  NOW()
FROM "BASE_DE_LEADS" AS lead
WHERE LOWER(COALESCE(lead.estagio_lead, '')) = 'vendedor'
  AND NULLIF(TRIM(COALESCE(lead.vendedor, '')), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "AGENDAMENTOS" AS agendamento
    WHERE agendamento.id_empresa = lead.id_empresa
      AND agendamento.id_lead = lead.id
  );
