-- Move automaticamente leads de "nao_responde" para "resgate" após 48h
-- Exceção: não move leads que possuam agendamento vinculado em "agendado" ou "reagendado"
-- Requer extensão pg_cron habilitada no projeto Supabase

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.auto_move_nao_responde_to_resgate()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  moved_count integer := 0;
BEGIN
  UPDATE "BASE_DE_LEADS" b
  SET
    estagio_lead = 'resgate',
    updated_at = NOW()
  WHERE LOWER(COALESCE(b.estagio_lead, '')) = 'nao_responde'
    AND b.updated_at <= NOW() - INTERVAL '48 hours'
    AND NOT EXISTS (
      SELECT 1
      FROM "AGENDAMENTOS" a
      WHERE a.id_lead = b.id
        AND a.id_empresa = b.id_empresa
        AND LOWER(COALESCE(a.estagio_agendamento, '')) IN ('agendado', 'reagendado')
    );

  GET DIAGNOSTICS moved_count = ROW_COUNT;
  RETURN moved_count;
END;
$$;

-- Remove agendamento anterior com o mesmo nome, se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'auto-move-nao-responde-to-resgate'
  ) THEN
    PERFORM cron.unschedule('auto-move-nao-responde-to-resgate');
  END IF;
END $$;

-- Executa a cada 30 minutos
SELECT cron.schedule(
  'auto-move-nao-responde-to-resgate',
  '*/30 * * * *',
  $$SELECT public.auto_move_nao_responde_to_resgate();$$
);

-- Execução manual opcional para testar na hora:
-- SELECT public.auto_move_nao_responde_to_resgate();
