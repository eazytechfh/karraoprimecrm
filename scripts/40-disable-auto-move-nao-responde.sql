-- Desativa qualquer regra automatica que movia leads de "nao_responde" para "resgate".
-- Depois desta execucao, leads em "Nao Responde" ficam nessa etapa ate alguem mover manualmente.

DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'auto-move-nao-responde-to-resgate'
    ) THEN
      PERFORM cron.unschedule('auto-move-nao-responde-to-resgate');
      RAISE NOTICE 'Job auto-move-nao-responde-to-resgate desagendado.';
    ELSE
      RAISE NOTICE 'Job auto-move-nao-responde-to-resgate nao encontrado.';
    END IF;
  ELSE
    RAISE NOTICE 'Tabela cron.job nao encontrada; nao ha job do pg_cron para desagendar.';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.auto_move_nao_responde_to_resgate();

-- Conferencia opcional, rode separadamente se a extensao pg_cron existir:
-- SELECT jobid, jobname, schedule, command
-- FROM cron.job
-- WHERE jobname ILIKE '%nao%responde%'
--    OR command ILIKE '%nao_responde%';
