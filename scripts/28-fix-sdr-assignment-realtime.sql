-- Remove triggers antigos e cria novo trigger corrigido
DROP TRIGGER IF EXISTS create_agendamento_on_transferido_trigger ON "BASE_DE_LEADS";
DROP TRIGGER IF EXISTS assign_sdr_from_vendedor_trigger ON "AGENDAMENTOS";
DROP FUNCTION IF EXISTS create_agendamento_on_transferido() CASCADE;
DROP FUNCTION IF EXISTS assign_sdr_from_vendedor() CASCADE;

-- Função corrigida que cria agendamento E já atribui o SDR correto
CREATE OR REPLACE FUNCTION create_agendamento_with_sdr()
RETURNS TRIGGER AS $$
DECLARE
    existing_count INTEGER;
    sdr_name TEXT;
BEGIN
    -- Só executa quando o estágio muda para 'transferido'
    IF NEW.estagio_lead = 'transferido' AND (OLD.estagio_lead IS NULL OR LOWER(OLD.estagio_lead) != 'transferido') THEN
        
        -- Verifica se já existe agendamento para este lead
        SELECT COUNT(*) INTO existing_count
        FROM "AGENDAMENTOS"
        WHERE id_lead = NEW.id;
        
        -- Se não existir, cria o agendamento
        IF existing_count = 0 THEN
            
            -- Busca o nome do SDR baseado no campo vendedor
            -- Primeiro tenta match exato, depois case-insensitive
            SELECT nome_usuario INTO sdr_name
            FROM "AUTORIZAÇÃO"
            WHERE id_empresa = NEW.id_empresa
            AND cargo = 'sdr'
            AND (
                nome_usuario = NEW.vendedor 
                OR LOWER(TRIM(nome_usuario)) = LOWER(TRIM(NEW.vendedor))
            )
            LIMIT 1;
            
            -- Se não encontrou SDR pelo vendedor, usa o sdr_responsavel do lead
            IF sdr_name IS NULL AND NEW.sdr_responsavel IS NOT NULL THEN
                sdr_name := NEW.sdr_responsavel;
            END IF;
            
            -- Cria o agendamento com o SDR correto
            INSERT INTO "AGENDAMENTOS" (
                id_lead,
                nome_lead,
                telefone,
                email,
                modelo_veiculo,
                observacao,
                sdr_responsavel,
                estagio_agendamento,
                id_empresa,
                created_at
            ) VALUES (
                NEW.id,
                NEW.nome_lead,
                NEW.telefone,
                NEW.email,
                NEW.veiculo_interesse,
                NEW.observacao_vendedor,
                sdr_name,  -- Atribui o SDR aqui
                'agendar',
                NEW.id_empresa,
                NOW()
            );
            
            RAISE NOTICE 'Agendamento criado para lead % com SDR %', NEW.id, sdr_name;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria trigger
CREATE TRIGGER create_agendamento_with_sdr_trigger
AFTER INSERT OR UPDATE OF estagio_lead ON "BASE_DE_LEADS"
FOR EACH ROW
EXECUTE FUNCTION create_agendamento_with_sdr();

-- Corrige agendamentos existentes sem SDR responsável
UPDATE "AGENDAMENTOS" a
SET sdr_responsavel = (
    SELECT nome_usuario
    FROM "AUTORIZAÇÃO" au
    WHERE au.id_empresa = a.id_empresa
    AND au.cargo = 'sdr'
    AND (
        au.nome_usuario = (SELECT vendedor FROM "BASE_DE_LEADS" WHERE id = a.id_lead)
        OR LOWER(TRIM(au.nome_usuario)) = LOWER(TRIM((SELECT vendedor FROM "BASE_DE_LEADS" WHERE id = a.id_lead)))
    )
    LIMIT 1
)
WHERE sdr_responsavel IS NULL
AND id_lead IS NOT NULL;
