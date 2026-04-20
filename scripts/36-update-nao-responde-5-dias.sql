-- Atualiza a regra de auto-move de "nao_responde" para "resgate" de 48h para 5 dias
-- Requer extensão pg_cron habilitada no projeto Supabase (alternativa ao Vercel Cron)

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
    AND b.updated_at <= NOW() - INTERVAL '5 days'
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

-- Reagenda o cron (roda todo dia às 03:00)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-move-nao-responde-to-resgate') THEN
    PERFORM cron.unschedule('auto-move-nao-responde-to-resgate');
  END IF;
END $$;

SELECT cron.schedule(
  'auto-move-nao-responde-to-resgate',
  '0 3 * * *',
  $$SELECT public.auto_move_nao_responde_to_resgate();$$
);

-- Teste manual:
-- SELECT public.auto_move_nao_responde_to_resgate();
