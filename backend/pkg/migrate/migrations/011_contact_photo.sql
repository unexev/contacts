-- Object path of the contact's profile photo in the private storage bucket; NULL when none.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS photo_path TEXT;
