-- Criar tabela AGENDAMENTOS
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
  id_vendedor INTEGER REFERENCES "VENDEDORES"(id),
  estagio_agendamento VARCHAR(50) DEFAULT 'agendar' CHECK (estagio_agendamento IN ('agendar', 'agendado', 'nao_compareceu', 'reagendado', 'visita_realizada', 'sucesso', 'insucesso')),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_agendamentos_id_empresa ON "AGENDAMENTOS"(id_empresa);
CREATE INDEX IF NOT EXISTS idx_agendamentos_id_lead ON "AGENDAMENTOS"(id_lead);
CREATE INDEX IF NOT EXISTS idx_agendamentos_estagio ON "AGENDAMENTOS"(estagio_agendamento);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON "AGENDAMENTOS"(data_agendamento);
