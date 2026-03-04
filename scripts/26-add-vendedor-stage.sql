-- Add "vendedor" stage to the valid stages constraint
-- This script updates the estagio_lead constraint to include the new "vendedor" stage

-- Drop the existing constraint
ALTER TABLE "BASE_DE_LEADS" DROP CONSTRAINT IF EXISTS "BASE_DE_LEADS_estagio_lead_check";

-- Add the new constraint with "vendedor" stage included
ALTER TABLE "BASE_DE_LEADS" 
ADD CONSTRAINT "BASE_DE_LEADS_estagio_lead_check" 
CHECK (LOWER(estagio_lead) IN ('novo_lead', 'em_qualificacao', 'transferido', 'vendedor', 'follow_up'));

-- Update any existing leads if needed (this is optional, only if you want to migrate some leads)
-- UPDATE "BASE_DE_LEADS" SET estagio_lead = 'vendedor' WHERE estagio_lead = 'some_old_value';
