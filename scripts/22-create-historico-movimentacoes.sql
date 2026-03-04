-- Cria tabela para armazenar o histórico de movimentações
CREATE TABLE IF NOT EXISTS "HISTORICO_MOVIMENTACOES" (
  id SERIAL PRIMARY KEY,
  id_agendamento INTEGER NOT NULL REFERENCES "AGENDAMENTOS"(id) ON DELETE CASCADE,
  id_empresa INTEGER NOT NULL,
  estagio_anterior VARCHAR(100),
  estagio_novo VARCHAR(100) NOT NULL,
  usuario_nome VARCHAR(255) NOT NULL,
  usuario_cargo VARCHAR(100) NOT NULL,
  motivo_perda VARCHAR(255),
  observacao TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_historico_agendamento ON "HISTORICO_MOVIMENTACOES"(id_agendamento);
CREATE INDEX IF NOT EXISTS idx_historico_empresa ON "HISTORICO_MOVIMENTACOES"(id_empresa);
CREATE INDEX IF NOT EXISTS idx_historico_created ON "HISTORICO_MOVIMENTACOES"(created_at DESC);

-- Adiciona coluna observacoes_vendedor na tabela AGENDAMENTOS se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'AGENDAMENTOS' AND column_name = 'observacoes_vendedor'
  ) THEN
    ALTER TABLE "AGENDAMENTOS" ADD COLUMN observacoes_vendedor TEXT;
  END IF;
END $$;
