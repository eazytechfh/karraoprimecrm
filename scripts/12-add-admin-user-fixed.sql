-- Script corrigido para adicionar usuário administrador principal
-- Usando 'administrador' como cargo válido

INSERT INTO "AUTORIZAÇÃO" (id_empresa, nome_empresa, nome_usuario, email, senha, telefone, plano, status, cargo)
VALUES (1, 'Karrao Multimarcas', 'Admin', 'karraomultimarcas@admin.com.br', 'admin123', '(11) 99999-9999', 'premium', 'ativo', 'administrador')
ON CONFLICT (email) DO UPDATE SET
  nome_empresa = EXCLUDED.nome_empresa,
  nome_usuario = EXCLUDED.nome_usuario,
  cargo = EXCLUDED.cargo,
  plano = EXCLUDED.plano,
  status = EXCLUDED.status,
  updated_at = NOW();
