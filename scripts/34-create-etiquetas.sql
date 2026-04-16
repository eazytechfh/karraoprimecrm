CREATE TABLE IF NOT EXISTS "ETIQUETAS" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa BIGINT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  cor VARCHAR(7) NOT NULL DEFAULT '#8b5cf6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "LEAD_ETIQUETAS" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empresa BIGINT NOT NULL,
  id_lead BIGINT NOT NULL,
  id_etiqueta UUID NOT NULL REFERENCES "ETIQUETAS"(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lead_etiquetas_unique UNIQUE (id_empresa, id_lead, id_etiqueta)
);

CREATE INDEX IF NOT EXISTS idx_etiquetas_empresa ON "ETIQUETAS"(id_empresa);
CREATE INDEX IF NOT EXISTS idx_lead_etiquetas_empresa_lead ON "LEAD_ETIQUETAS"(id_empresa, id_lead);
CREATE INDEX IF NOT EXISTS idx_lead_etiquetas_empresa_etiqueta ON "LEAD_ETIQUETAS"(id_empresa, id_etiqueta);
