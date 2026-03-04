-- Script para corrigir o trigger de transferência automática para agendamentos
-- Este trigger cria um agendamento quando o estagio_lead é alterado para "transferido"

-- Primeiro, remover o trigger e função antigos se existirem
DROP TRIGGER IF EXISTS trigger_create_agendamento_on_transferido ON "BASE_DE_LEADS";
DROP FUNCTION IF EXISTS create_agendamento_on_transferido();

-- Criar a função que será executada pelo trigger
CREATE OR REPLACE FUNCTION create_agendamento_on_transferido()
RETURNS TRIGGER AS $$
BEGIN
    -- Verifica se o estágio foi alterado para "transferido" (case-insensitive)
    IF (OLD.estagio_lead IS DISTINCT FROM NEW.estagio_lead) 
       AND LOWER(NEW.estagio_lead) = 'transferido' THEN
        
        -- Verifica se já existe um agendamento para este lead
        IF NOT EXISTS (
            SELECT 1 FROM "AGENDAMENTOS" WHERE id_lead = NEW.id
        ) THEN
            -- Cria um novo agendamento na coluna "agendar"
            INSERT INTO "AGENDAMENTOS" (
                id_empresa,
                id_lead,
                nome_lead,
                telefone,
                email,
                modelo_veiculo,
                estagio_agendamento,
                observacoes,
                sdr_responsavel,
                created_at,
                updated_at
            ) VALUES (
                NEW.id_empresa,
                NEW.id,
                COALESCE(NEW.nome_lead, 'Lead sem nome'),
                NEW.telefone,
                NEW.email,
                NEW.veiculo_interesse,
                'agendar',
                NEW.observacao_vendedor,
                NEW.sdr_responsavel,
                NOW(),
                NOW()
            );
            
            RAISE NOTICE 'Agendamento criado automaticamente para lead %', NEW.id;
        ELSE
            RAISE NOTICE 'Agendamento já existe para lead %', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar o trigger que executa a função após UPDATE na tabela BASE_DE_LEADS
CREATE TRIGGER trigger_create_agendamento_on_transferido
    AFTER UPDATE ON "BASE_DE_LEADS"
    FOR EACH ROW
    EXECUTE FUNCTION create_agendamento_on_transferido();

-- Verificar se o trigger foi criado corretamente
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_create_agendamento_on_transferido';
