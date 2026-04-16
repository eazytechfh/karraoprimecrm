CREATE TABLE IF NOT EXISTS "LEAD_HISTORICO" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_lead BIGINT NOT NULL REFERENCES "BASE_DE_LEADS"(id) ON DELETE CASCADE,
  id_empresa BIGINT NOT NULL,
  descricao TEXT NOT NULL,
  usuario_nome VARCHAR(255) NOT NULL,
  usuario_cargo VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_historico_lead ON "LEAD_HISTORICO"(id_lead);
CREATE INDEX IF NOT EXISTS idx_lead_historico_empresa ON "LEAD_HISTORICO"(id_empresa);
CREATE INDEX IF NOT EXISTS idx_lead_historico_created ON "LEAD_HISTORICO"(created_at DESC);
