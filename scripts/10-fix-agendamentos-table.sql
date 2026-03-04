-- Script corrigido para criar tabela AGENDAMENTOS
-- Remove a referência à tabela VENDEDORES que não existe

-- Primeiro, dropar a tabela se existir com erro
DROP TABLE IF EXISTS "AGENDAMENTOS" CASCADE;

-- Criar tabela AGENDAMENTOS sem referência à tabela VENDEDORES
CREATE TABLE IF NOT EXISTS "AGENDAMENTOS" (
  id SERIAL PRIMARY KEY,
  id_empresa INTEGER NOT NULL,
  id_lead INTEGER NOT NULL REFERENCES "BASE_DE_LEADS"(id) ON DELETE CASCADE,
  nome_lead VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(255),
  modelo_veiculo VARCHAR(255),
  data_agendamento DATE,
  hora_agendamento TIME,
  vendedor VARCHAR(255),
  -- Removido: id_vendedor INTEGER REFERENCES "VENDEDORES"(id) - tabela não existe
  estagio_agendamento VARCHAR(50) DEFAULT 'agendar' CHECK (estagio_agendamento IN ('agendar', 'agendado', 'realizou_visita', 'fechou', 'nao_fechou')),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_agendamentos_id_empresa ON "AGENDAMENTOS"(id_empresa);
CREATE INDEX IF NOT EXISTS idx_agendamentos_id_lead ON "AGENDAMENTOS"(id_lead);
CREATE INDEX IF NOT EXISTS idx_agendamentos_estagio ON "AGENDAMENTOS"(estagio_agendamento);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON "AGENDAMENTOS"(data_agendamento);
