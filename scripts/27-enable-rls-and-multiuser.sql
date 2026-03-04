-- Habilitar RLS (Row Level Security) nas tabelas principais
ALTER TABLE "BASE_DE_LEADS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AGENDAMENTOS" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HISTORICO_MOVIMENTACOES" ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "leads_empresa_policy" ON "BASE_DE_LEADS";
DROP POLICY IF EXISTS "leads_sdr_policy" ON "BASE_DE_LEADS";
DROP POLICY IF EXISTS "leads_vendedor_policy" ON "BASE_DE_LEADS";
DROP POLICY IF EXISTS "agendamentos_empresa_policy" ON "AGENDAMENTOS";
DROP POLICY IF EXISTS "agendamentos_sdr_policy" ON "AGENDAMENTOS";
DROP POLICY IF EXISTS "agendamentos_vendedor_policy" ON "AGENDAMENTOS";
DROP POLICY IF EXISTS "historico_empresa_policy" ON "HISTORICO_MOVIMENTACOES";

-- ====================================
-- POLÍTICAS PARA BASE_DE_LEADS
-- ====================================

-- Admin e Gestor veem todos os leads da empresa
CREATE POLICY "leads_admin_gestor_policy" ON "BASE_DE_LEADS"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "AUTORIZAÇÃO" 
    WHERE "AUTORIZAÇÃO".id_empresa = "BASE_DE_LEADS".id_empresa
    AND "AUTORIZAÇÃO".cargo IN ('administrador', 'gestor')
  )
);

-- SDR vê apenas os leads onde ele é o sdr_responsavel
CREATE POLICY "leads_sdr_policy" ON "BASE_DE_LEADS"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "AUTORIZAÇÃO" 
    WHERE "AUTORIZAÇÃO".id_empresa = "BASE_DE_LEADS".id_empresa
    AND "AUTORIZAÇÃO".cargo = 'sdr'
    AND "AUTORIZAÇÃO".nome_usuario = "BASE_DE_LEADS".sdr_responsavel
  )
);

-- Vendedor vê leads da empresa (para contexto)
CREATE POLICY "leads_vendedor_policy" ON "BASE_DE_LEADS"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "AUTORIZAÇÃO" 
    WHERE "AUTORIZAÇÃO".id_empresa = "BASE_DE_LEADS".id_empresa
    AND "AUTORIZAÇÃO".cargo = 'vendedor'
  )
);

-- ====================================
-- POLÍTICAS PARA AGENDAMENTOS
-- ====================================

-- Admin e Gestor veem todos os agendamentos da empresa
CREATE POLICY "agendamentos_admin_gestor_policy" ON "AGENDAMENTOS"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "AUTORIZAÇÃO" 
    WHERE "AUTORIZAÇÃO".id_empresa = "AGENDAMENTOS".id_empresa
    AND "AUTORIZAÇÃO".cargo IN ('administrador', 'gestor')
  )
);

-- SDR vê apenas agendamentos onde ele é o sdr_responsavel
CREATE POLICY "agendamentos_sdr_policy" ON "AGENDAMENTOS"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "AUTORIZAÇÃO" 
    WHERE "AUTORIZAÇÃO".id_empresa = "AGENDAMENTOS".id_empresa
    AND "AUTORIZAÇÃO".cargo = 'sdr'
    AND "AUTORIZAÇÃO".nome_usuario = "AGENDAMENTOS".sdr_responsavel
  )
);

-- Vendedor vê apenas agendamentos onde ele é o vendedor
CREATE POLICY "agendamentos_vendedor_policy" ON "AGENDAMENTOS"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "AUTORIZAÇÃO" 
    WHERE "AUTORIZAÇÃO".id_empresa = "AGENDAMENTOS".id_empresa
    AND "AUTORIZAÇÃO".cargo = 'vendedor'
    AND "AUTORIZAÇÃO".nome_usuario = "AGENDAMENTOS".vendedor
  )
);

-- ====================================
-- POLÍTICAS PARA HISTORICO_MOVIMENTACOES
-- ====================================

-- Todos da empresa podem ver o histórico
CREATE POLICY "historico_empresa_policy" ON "HISTORICO_MOVIMENTACOES"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "AUTORIZAÇÃO" 
    WHERE "AUTORIZAÇÃO".id_empresa = "HISTORICO_MOVIMENTACOES".id_empresa
  )
);

-- Todos autenticados podem inserir histórico
CREATE POLICY "historico_insert_policy" ON "HISTORICO_MOVIMENTACOES"
FOR INSERT
WITH CHECK (true);

-- ====================================
-- TRIGGER: Direcionar agendamento para SDR correto
-- ====================================

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS auto_assign_sdr_on_transferido ON "BASE_DE_LEADS";
DROP FUNCTION IF EXISTS assign_sdr_from_vendedor();

-- Função para buscar o SDR pelo nome do vendedor e criar agendamento
CREATE OR REPLACE FUNCTION assign_sdr_from_vendedor()
RETURNS TRIGGER AS $$
DECLARE
  v_sdr_usuario varchar;
BEGIN
  -- Verifica se mudou para "transferido"
  IF NEW.estagio_lead = 'transferido' AND (OLD.estagio_lead IS NULL OR OLD.estagio_lead != 'transferido') THEN
    
    -- Busca o nome do usuário SDR correspondente ao vendedor do lead
    SELECT nome_usuario INTO v_sdr_usuario
    FROM "AUTORIZAÇÃO"
    WHERE id_empresa = NEW.id_empresa
      AND cargo = 'sdr'
      AND LOWER(TRIM(nome_usuario)) = LOWER(TRIM(NEW.vendedor))
    LIMIT 1;
    
    -- Se encontrou o SDR, atualiza o sdr_responsavel no lead
    IF v_sdr_usuario IS NOT NULL THEN
      NEW.sdr_responsavel := v_sdr_usuario;
      
      -- Cria agendamento vinculado ao SDR correto (se não existir)
      IF NOT EXISTS (SELECT 1 FROM "AGENDAMENTOS" WHERE id_lead = NEW.id) THEN
        INSERT INTO "AGENDAMENTOS" (
          id_empresa,
          id_lead,
          nome_lead,
          telefone,
          email,
          modelo_veiculo,
          observacoes,
          vendedor,
          estagio_agendamento,
          sdr_responsavel,
          created_at,
          updated_at
        ) VALUES (
          NEW.id_empresa,
          NEW.id,
          NEW.nome_lead,
          NEW.telefone,
          NEW.email,
          NEW.veiculo_interesse,
          NEW.observacao_vendedor,
          NEW.vendedor,
          'agendar',
          v_sdr_usuario,
          NOW(),
          NOW()
        );
        
        RAISE NOTICE 'Agendamento criado para SDR: % (lead: %)', v_sdr_usuario, NEW.id;
      END IF;
    ELSE
      RAISE WARNING 'Nenhum SDR encontrado com nome: % na empresa: %', NEW.vendedor, NEW.id_empresa;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria o trigger
CREATE TRIGGER auto_assign_sdr_on_transferido
  BEFORE UPDATE ON "BASE_DE_LEADS"
  FOR EACH ROW
  EXECUTE FUNCTION assign_sdr_from_vendedor();

-- ====================================
-- ÍNDICES para melhorar performance
-- ====================================

CREATE INDEX IF NOT EXISTS idx_leads_sdr_responsavel ON "BASE_DE_LEADS"(sdr_responsavel);
CREATE INDEX IF NOT EXISTS idx_leads_empresa_estagio ON "BASE_DE_LEADS"(id_empresa, estagio_lead);
CREATE INDEX IF NOT EXISTS idx_agendamentos_sdr ON "AGENDAMENTOS"(sdr_responsavel);
CREATE INDEX IF NOT EXISTS idx_agendamentos_vendedor ON "AGENDAMENTOS"(vendedor);
CREATE INDEX IF NOT EXISTS idx_agendamentos_empresa_estagio ON "AGENDAMENTOS"(id_empresa, estagio_agendamento);
