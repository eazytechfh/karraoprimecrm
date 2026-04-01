ALTER TABLE "AGENDAMENTOS" DROP CONSTRAINT IF EXISTS "AGENDAMENTOS_estagio_agendamento_check";
ALTER TABLE "AGENDAMENTOS" DROP CONSTRAINT IF EXISTS "AGENDAMENTOS_estagio_agendamento";
ALTER TABLE "AGENDAMENTOS" DROP CONSTRAINT IF EXISTS agendamentos_estagio_agendamento_check;

UPDATE "AGENDAMENTOS"
SET estagio_agendamento = LOWER(TRIM(estagio_agendamento))
WHERE estagio_agendamento IS NOT NULL;

UPDATE "AGENDAMENTOS"
SET estagio_agendamento = 'agendar'
WHERE estagio_agendamento IN ('agendar');

UPDATE "AGENDAMENTOS"
SET estagio_agendamento = 'agendado'
WHERE estagio_agendamento IN ('agendado');

UPDATE "AGENDAMENTOS"
SET estagio_agendamento = 'nao_compareceu'
WHERE estagio_agendamento IN ('nao_compareceu', 'não compareceu');

UPDATE "AGENDAMENTOS"
SET estagio_agendamento = 'reagendado'
WHERE estagio_agendamento IN ('reagendado');

UPDATE "AGENDAMENTOS"
SET estagio_agendamento = 'visita_realizada'
WHERE estagio_agendamento IN ('visita_realizada', 'realizou_visita', 'realizou a visita');

UPDATE "AGENDAMENTOS"
SET estagio_agendamento = 'sucesso'
WHERE estagio_agendamento IN ('sucesso', 'fechou');

UPDATE "AGENDAMENTOS"
SET estagio_agendamento = 'insucesso'
WHERE estagio_agendamento IN ('insucesso', 'nao_fechou', 'não fechou');

UPDATE "AGENDAMENTOS"
SET estagio_agendamento = 'agendar'
WHERE estagio_agendamento IS NULL
   OR estagio_agendamento NOT IN (
     'agendar',
     'agendado',
     'nao_compareceu',
     'reagendado',
     'visita_realizada',
     'sucesso',
     'insucesso'
   );

ALTER TABLE "AGENDAMENTOS"
ADD CONSTRAINT "AGENDAMENTOS_estagio_agendamento_check"
CHECK (
  LOWER(estagio_agendamento::text) = ANY (
    ARRAY[
      'agendar'::text,
      'agendado'::text,
      'nao_compareceu'::text,
      'reagendado'::text,
      'visita_realizada'::text,
      'sucesso'::text,
      'insucesso'::text
    ]
  )
);
