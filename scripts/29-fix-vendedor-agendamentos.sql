-- Atualiza o trigger para criar agendamentos quando o lead vai para 'transferido' OU 'vendedor'
DROP TRIGGER IF EXISTS create_agendamento_with_sdr_trigger ON "BASE_DE_LEADS";
DROP FUNCTION IF EXISTS create_agendamento_with_sdr() CASCADE;

-- Função corrigida que cria agendamento quando vai para 'transferido' OU 'vendedor'
CREATE OR REPLACE FUNCTION create_agendamento_with_sdr()
RETURNS TRIGGER AS $$
DECLARE
    existing_count INTEGER;
    sdr_name TEXT;
    vendedor_name TEXT;
BEGIN
    -- Executa quando o estágio muda para 'transferido' OU 'vendedor'
    IF (NEW.estagio_lead IN ('transferido', 'vendedor')) 
       AND (OLD.estagio_lead IS NULL OR LOWER(OLD.estagio_lead) NOT IN ('transferido', 'vendedor')) THEN
        
        -- Verifica se já existe agendamento para este lead
        SELECT COUNT(*) INTO existing_count
        FROM "AGENDAMENTOS"
        WHERE id_lead = NEW.id;
        
        -- Se não existir, cria o agendamento
        IF existing_count = 0 THEN
            
            -- Busca o nome do SDR baseado no campo vendedor do lead
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
            
            -- Pega o nome do vendedor do campo vendedor do lead
            vendedor_name := NEW.vendedor;
            
            -- Cria o agendamento com SDR e Vendedor corretos
            INSERT INTO "AGENDAMENTOS" (
                id_lead,
                nome_lead,
                telefone,
                email,
                modelo_veiculo,
                observacoes,
                sdr_responsavel,
                vendedor,
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
                sdr_name,
                vendedor_name,
                'agendar',
                NEW.id_empresa,
                NOW()
            );
            
            RAISE NOTICE 'Agendamento criado para lead % com SDR % e Vendedor %', NEW.id, sdr_name, vendedor_name;
        ELSE
            -- Se já existe agendamento, atualiza o vendedor caso esteja NULL
            UPDATE "AGENDAMENTOS"
            SET vendedor = NEW.vendedor,
                sdr_responsavel = COALESCE(sdr_responsavel, (
                    SELECT nome_usuario
                    FROM "AUTORIZAÇÃO"
                    WHERE id_empresa = NEW.id_empresa
                    AND cargo = 'sdr'
                    AND (
                        nome_usuario = NEW.vendedor 
                        OR LOWER(TRIM(nome_usuario)) = LOWER(TRIM(NEW.vendedor))
                    )
                    LIMIT 1
                ))
            WHERE id_lead = NEW.id
            AND (vendedor IS NULL OR vendedor != NEW.vendedor);
            
            RAISE NOTICE 'Agendamento atualizado para lead % com Vendedor %', NEW.id, NEW.vendedor;
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

-- Corrige agendamentos existentes para leads em 'transferido' ou 'vendedor' que não têm agendamento
INSERT INTO "AGENDAMENTOS" (
    id_lead,
    nome_lead,
    telefone,
    email,
    modelo_veiculo,
    observacoes,
    sdr_responsavel,
    vendedor,
    estagio_agendamento,
    id_empresa,
    created_at
)
SELECT 
    l.id,
    l.nome_lead,
    l.telefone,
    l.email,
    l.veiculo_interesse,
    l.observacao_vendedor,
    (
        SELECT nome_usuario
        FROM "AUTORIZAÇÃO"
        WHERE id_empresa = l.id_empresa
        AND cargo = 'sdr'
        AND (
            nome_usuario = l.vendedor 
            OR LOWER(TRIM(nome_usuario)) = LOWER(TRIM(l.vendedor))
        )
        LIMIT 1
    ) as sdr_responsavel,
    l.vendedor,
    'agendar',
    l.id_empresa,
    NOW()
FROM "BASE_DE_LEADS" l
WHERE l.estagio_lead IN ('transferido', 'vendedor')
AND NOT EXISTS (
    SELECT 1 
    FROM "AGENDAMENTOS" a 
    WHERE a.id_lead = l.id
);

-- Atualiza agendamentos existentes que têm vendedor NULL
UPDATE "AGENDAMENTOS" a
SET vendedor = (
    SELECT vendedor
    FROM "BASE_DE_LEADS"
    WHERE id = a.id_lead
),
sdr_responsavel = COALESCE(a.sdr_responsavel, (
    SELECT au.nome_usuario
    FROM "AUTORIZAÇÃO" au
    INNER JOIN "BASE_DE_LEADS" l ON l.id = a.id_lead
    WHERE au.id_empresa = a.id_empresa
    AND au.cargo = 'sdr'
    AND (
        au.nome_usuario = l.vendedor 
        OR LOWER(TRIM(au.nome_usuario)) = LOWER(TRIM(l.vendedor))
    )
    LIMIT 1
))
WHERE a.id_lead IS NOT NULL
AND (a.vendedor IS NULL OR a.sdr_responsavel IS NULL);
