-- Database RPC function to increment/decrement total_contacts in csv_files
CREATE OR REPLACE FUNCTION increment_csv_total_contacts(f_id UUID, inc INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE csv_files
  SET total_contacts = total_contacts + inc,
      updated_at = NOW()
  WHERE id = f_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
