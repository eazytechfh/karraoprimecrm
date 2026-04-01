-- Envia lembrete 1 hora antes para agendamentos em "agendado" ou "reagendado"
-- Destinatários: SDR responsável e vendedor
-- Requer extensões pg_cron e pg_net habilitadas no Supabase
-- Usa o mesmo webhook já existente de notificações de agendamento

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE "AGENDAMENTOS"
ADD COLUMN IF NOT EXISTS lembrete_1h_enviado_em TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.reset_agendamento_lembrete_1h()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.lembrete_1h_enviado_em := NULL;
    RETURN NEW;
  END IF;

  IF NEW.data_agendamento IS DISTINCT FROM OLD.data_agendamento
     OR NEW.hora_agendamento IS DISTINCT FROM OLD.hora_agendamento
     OR LOWER(COALESCE(NEW.estagio_agendamento, '')) IS DISTINCT FROM LOWER(COALESCE(OLD.estagio_agendamento, '')) THEN
    NEW.lembrete_1h_enviado_em := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reset_agendamento_lembrete_1h ON "AGENDAMENTOS";

CREATE TRIGGER trigger_reset_agendamento_lembrete_1h
BEFORE INSERT OR UPDATE ON "AGENDAMENTOS"
FOR EACH ROW
EXECUTE FUNCTION public.reset_agendamento_lembrete_1h();

CREATE OR REPLACE FUNCTION public.send_agendamento_reminder_1h()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  agendamento_record RECORD;
  scheduled_at TIMESTAMPTZ;
  moved_count integer := 0;
BEGIN
  FOR agendamento_record IN
    SELECT
      a.*,
      vendedor_user.email AS vendedor_email,
      vendedor_user.telefone AS vendedor_telefone,
      sdr_user.email AS sdr_email,
      sdr_user.telefone AS sdr_telefone
    FROM "AGENDAMENTOS" a
    LEFT JOIN "AUTORIZAÇÃO" vendedor_user
      ON vendedor_user.id_empresa = a.id_empresa
     AND LOWER(TRIM(vendedor_user.nome_usuario)) = LOWER(TRIM(COALESCE(a.vendedor, '')))
    LEFT JOIN "AUTORIZAÇÃO" sdr_user
      ON sdr_user.id_empresa = a.id_empresa
     AND LOWER(TRIM(sdr_user.nome_usuario)) = LOWER(TRIM(COALESCE(a.sdr_responsavel, '')))
    WHERE LOWER(COALESCE(a.estagio_agendamento, '')) IN ('agendado', 'reagendado')
      AND a.data_agendamento IS NOT NULL
      AND a.hora_agendamento IS NOT NULL
      AND a.lembrete_1h_enviado_em IS NULL
  LOOP
    scheduled_at := (agendamento_record.data_agendamento::text || ' ' || agendamento_record.hora_agendamento::text)::timestamp AT TIME ZONE 'America/Sao_Paulo';

    IF scheduled_at >= NOW() + INTERVAL '55 minutes'
       AND scheduled_at < NOW() + INTERVAL '65 minutes' THEN

      PERFORM net.http_post(
        url := 'https://n8n.eazy.tec.br/webhook/76515376-a7e4-4380-bc57-c04942f1f650',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := jsonb_build_object(
          'action', 'agendamento_reminder_1h',
          'id', agendamento_record.id,
          'id_empresa', agendamento_record.id_empresa,
          'id_lead', agendamento_record.id_lead,
          'nome_lead', agendamento_record.nome_lead,
          'telefone', agendamento_record.telefone,
          'email', agendamento_record.email,
          'modelo_veiculo', agendamento_record.modelo_veiculo,
          'data_agendamento', agendamento_record.data_agendamento,
          'hora_agendamento', agendamento_record.hora_agendamento,
          'vendedor', agendamento_record.vendedor,
          'vendedor_email', agendamento_record.vendedor_email,
          'vendedor_telefone', agendamento_record.vendedor_telefone,
          'sdr_responsavel', agendamento_record.sdr_responsavel,
          'sdr_email', agendamento_record.sdr_email,
          'sdr_telefone', agendamento_record.sdr_telefone,
          'estagio_agendamento', agendamento_record.estagio_agendamento,
          'observacoes', agendamento_record.observacoes,
          'observacoes_vendedor', agendamento_record.observacoes_vendedor,
          'timestamp', NOW()
        )
      );

      UPDATE "AGENDAMENTOS"
      SET lembrete_1h_enviado_em = NOW()
      WHERE id = agendamento_record.id;

      moved_count := moved_count + 1;
    END IF;
  END LOOP;

  RETURN moved_count;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'send-agendamento-reminder-1h'
  ) THEN
    PERFORM cron.unschedule('send-agendamento-reminder-1h');
  END IF;
END $$;

SELECT cron.schedule(
  'send-agendamento-reminder-1h',
  '*/5 * * * *',
  $$SELECT public.send_agendamento_reminder_1h();$$
);

-- Teste manual:
-- SELECT public.send_agendamento_reminder_1h();
