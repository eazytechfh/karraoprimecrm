-- Adicionar usuário administrador principal
INSERT INTO "AUTORIZAÇÃO" (id_empresa, nome_empresa, nome_usuario, email, senha, telefone, plano, status, cargo)
VALUES (1, 'Karrao Multimarcas', 'Admin', 'karraomultimarcas@admin.com.br', 'admin123', '(11) 99999-9999', 'premium', 'ativo', 'gestor')
ON CONFLICT (email) DO NOTHING;
