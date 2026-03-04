-- Criar tabela AUTORIZAÇÃO
CREATE TABLE IF NOT EXISTS "AUTORIZAÇÃO" (
  id SERIAL PRIMARY KEY,
  id_empresa INTEGER NOT NULL,
  nome_empresa VARCHAR(255) NOT NULL,
  nome_usuario VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  plano VARCHAR(50) DEFAULT 'gratuito',
  status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'pendente', 'inativo')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar tabela BASE_DE_LEADS
CREATE TABLE IF NOT EXISTS "BASE_DE_LEADS" (
  id SERIAL PRIMARY KEY,
  id_empresa INTEGER NOT NULL,
  nome_lead VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  email VARCHAR(255),
  origem VARCHAR(100),
  vendedor VARCHAR(255),
  veiculo_interesse VARCHAR(255),
  resumo_qualificacao TEXT,
  estagio_lead VARCHAR(50) DEFAULT 'oportunidade' CHECK (estagio_lead IN ('oportunidade', 'em_qualificacao', 'qualificado', 'follow_up', 'nutricao', 'fechado', 'nao_fechou')),
  resumo_comercial TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserir usuário admin padrão
INSERT INTO "AUTORIZAÇÃO" (id_empresa, nome_empresa, nome_usuario, email, senha, telefone, plano, status)
VALUES (1, 'Administração', 'Admin', 'admin@admin.com.br', 'admin123', '(11) 99999-9999', 'premium', 'ativo')
ON CONFLICT (email) DO NOTHING;

-- Inserir alguns leads de exemplo
INSERT INTO "BASE_DE_LEADS" (id_empresa, nome_lead, telefone, email, origem, vendedor, veiculo_interesse, resumo_qualificacao, estagio_lead, resumo_comercial)
VALUES 
  (1, 'João Silva', '(11) 98765-4321', 'joao@email.com', 'Site', 'Carlos Vendedor', 'Honda Civic', 'Cliente interessado em financiamento', 'oportunidade', 'Primeiro contato realizado'),
  (1, 'Maria Santos', '(11) 87654-3210', 'maria@email.com', 'Facebook', 'Ana Vendedora', 'Toyota Corolla', 'Cliente com boa renda', 'em_qualificacao', 'Aguardando documentação'),
  (1, 'Pedro Costa', '(11) 76543-2109', 'pedro@email.com', 'Google Ads', 'Carlos Vendedor', 'Volkswagen Jetta', 'Cliente qualificado', 'qualificado', 'Proposta enviada'),
  (1, 'Ana Oliveira', '(11) 65432-1098', 'ana@email.com', 'Indicação', 'Ana Vendedora', 'Nissan Sentra', 'Follow up necessário', 'follow_up', 'Reagendar visita'),
  (1, 'Carlos Lima', '(11) 54321-0987', 'carlos@email.com', 'Site', 'Carlos Vendedor', 'Hyundai HB20', 'Em processo de nutrição', 'nutricao', 'Enviando materiais');
