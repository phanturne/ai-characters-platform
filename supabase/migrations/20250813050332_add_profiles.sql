-- Add profiles table migration
-- This migration creates the profiles table and related functionality

-- Create Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    username TEXT NOT NULL UNIQUE 
        CHECK (
            char_length(username) >= 3 
            AND char_length(username) <= 25
            AND username ~* '^[a-zA-Z0-9_-]+$'
        ),
    display_name TEXT NOT NULL 
        CHECK (
            char_length(display_name) <= 100
            AND char_length(display_name) > 0
        ),
    avatar_url TEXT
        CHECK (
            avatar_url IS NULL OR (
                char_length(avatar_url) <= 1000
                AND avatar_url ~* '^https?://'
            )
        ),
    bio TEXT NOT NULL DEFAULT ''
        CHECK (char_length(bio) <= 500)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_profile_user_id" ON profiles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_profile_username" ON profiles(username);

-- Create trigger for updated_at column
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle avatar deletion
CREATE OR REPLACE FUNCTION delete_old_avatar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only proceed if avatar_url has changed and old avatar exists
    IF OLD.avatar_url IS NOT NULL AND (TG_OP = 'DELETE' OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url) THEN
        -- Extract the path from the avatar_url
        -- Note: This assumes a specific storage path format
        -- If your storage structure changes, update this function accordingly
        DECLARE
            avatar_path TEXT;
        BEGIN
            -- More robust path extraction - handle various URL formats
            avatar_path := CASE 
                WHEN OLD.avatar_url LIKE '%/avatars/%' THEN 
                    regexp_replace(OLD.avatar_url, '^.*/avatars/', '')
                WHEN OLD.avatar_url LIKE '%/storage/%' THEN
                    regexp_replace(OLD.avatar_url, '^.*/storage/v1/object/public/avatars/', '')
                ELSE 
                    OLD.avatar_url
            END;
            
            -- Delete the old avatar from storage if path was extracted successfully
            IF avatar_path != OLD.avatar_url THEN
                DELETE FROM storage.objects
                WHERE bucket_id = 'avatars'
                AND name = avatar_path;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but don't prevent the trigger from completing
                RAISE WARNING 'Failed to delete old avatar: %', SQLERRM;
        END;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_avatar_change
    BEFORE UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION delete_old_avatar();

-- Create avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access to profile"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Allow users to update own profile"
    ON profiles FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow profile creation by authenticated users"
    ON profiles FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Storage Policies
CREATE POLICY "Allow public read access on avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

CREATE POLICY "Allow authenticated access to own avatars"
    ON storage.objects FOR ALL TO authenticated
    USING (
        bucket_id = 'avatars' 
        AND owner = auth.uid()
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'avatars' 
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND (ARRAY_LENGTH(regexp_split_to_array(name, '/'), 1) = 2)
    );