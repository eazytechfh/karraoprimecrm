-- Add fields to store sale information when lead is closed/won
ALTER TABLE "AGENDAMENTOS"
ADD COLUMN IF NOT EXISTS data_venda DATE,
ADD COLUMN IF NOT EXISTS veiculo_vendido VARCHAR(255),
ADD COLUMN IF NOT EXISTS valor_venda NUMERIC(10, 2);

COMMENT ON COLUMN "AGENDAMENTOS".data_venda IS 'Data em que a venda foi realizada';
COMMENT ON COLUMN "AGENDAMENTOS".veiculo_vendido IS 'Veículo que foi vendido';
COMMENT ON COLUMN "AGENDAMENTOS".valor_venda IS 'Valor da venda realizada';
