-- Migration: Add document_kind enum and update document table
-- This migration replaces the VARCHAR(10) with CHECK constraint approach
-- with a proper PostgreSQL enum type for better type safety

-- Step 1: Create the document_kind enum type
CREATE TYPE document_kind AS ENUM ('code', 'text', 'image', 'sheet');

-- Step 2: Add a new column with the enum type
ALTER TABLE document ADD COLUMN kind_new document_kind;

-- Step 3: Populate the new column with converted values
-- This ensures data integrity during the migration
UPDATE document SET kind_new = 
  CASE 
    WHEN kind = 'code' THEN 'code'::document_kind
    WHEN kind = 'text' THEN 'text'::document_kind
    WHEN kind = 'image' THEN 'image'::document_kind
    WHEN kind = 'sheet' THEN 'sheet'::document_kind
    ELSE 'text'::document_kind  -- Default fallback
  END;

-- Step 4: Make the new column NOT NULL
ALTER TABLE document ALTER COLUMN kind_new SET NOT NULL;

-- Step 5: Drop the old column and rename the new one
ALTER TABLE document DROP COLUMN kind;
ALTER TABLE document RENAME COLUMN kind_new TO kind;

-- Step 6: Set the default value for the new enum column
ALTER TABLE document ALTER COLUMN kind SET DEFAULT 'text';

-- Step 7: Drop the old CHECK constraint (it's no longer needed with enum)
-- Note: The CHECK constraint was defined inline in the original migration
-- so we don't need to explicitly drop it

-- Step 8: Recreate the index on the new enum column
DROP INDEX IF EXISTS document_kind_idx;
CREATE INDEX document_kind_idx ON document(kind);

-- Step 9: Add a comment to document the enum
COMMENT ON TYPE document_kind IS 'Enumeration of document types: code, text, image, sheet';
COMMENT ON COLUMN document.kind IS 'Type of document using document_kind enum';
