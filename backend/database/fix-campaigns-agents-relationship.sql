-- Fix campaigns foreign key relationships
-- This adds the missing foreign key constraints for campaigns table

-- Add foreign key constraint for assistant_id -> agents.id
ALTER TABLE campaigns 
ADD CONSTRAINT fk_campaigns_assistant_id 
FOREIGN KEY (assistant_id) REFERENCES agents(id) ON DELETE CASCADE;

-- Add foreign key constraint for contact_list_id -> contact_lists.id
ALTER TABLE campaigns 
ADD CONSTRAINT fk_campaigns_contact_list_id 
FOREIGN KEY (contact_list_id) REFERENCES contact_lists(id) ON DELETE SET NULL;

-- Add foreign key constraint for csv_file_id -> csv_files.id
ALTER TABLE campaigns 
ADD CONSTRAINT fk_campaigns_csv_file_id 
FOREIGN KEY (csv_file_id) REFERENCES csv_files(id) ON DELETE SET NULL;

-- Add indexes for better performance on the foreign keys
CREATE INDEX IF NOT EXISTS idx_campaigns_assistant_id_fk ON campaigns(assistant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_contact_list_id_fk ON campaigns(contact_list_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_csv_file_id_fk ON campaigns(csv_file_id);

-- Add comments for documentation
COMMENT ON CONSTRAINT fk_campaigns_assistant_id ON campaigns IS 'Foreign key constraint linking campaigns to agents';
COMMENT ON CONSTRAINT fk_campaigns_contact_list_id ON campaigns IS 'Foreign key constraint linking campaigns to contact lists';
COMMENT ON CONSTRAINT fk_campaigns_csv_file_id ON campaigns IS 'Foreign key constraint linking campaigns to CSV files';
