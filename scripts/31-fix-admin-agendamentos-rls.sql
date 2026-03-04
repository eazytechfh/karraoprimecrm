-- Fix: Administrador deve ver TODOS os agendamentos da empresa
-- O problema é que as políticas RLS não funcionam corretamente
-- com autenticação customizada (sem Supabase Auth session).
-- A filtragem por cargo já é feita no código da aplicação (getAgendamentos).

-- Desabilitar RLS na tabela AGENDAMENTOS para permitir acesso total
-- A filtragem por usuário/cargo é feita no application code
ALTER TABLE "AGENDAMENTOS" DISABLE ROW LEVEL SECURITY;

-- Também desabilitar RLS na BASE_DE_LEADS pelo mesmo motivo
ALTER TABLE "BASE_DE_LEADS" DISABLE ROW LEVEL SECURITY;

-- Manter RLS desabilitado no HISTORICO_MOVIMENTACOES também
ALTER TABLE "HISTORICO_MOVIMENTACOES" DISABLE ROW LEVEL SECURITY;
