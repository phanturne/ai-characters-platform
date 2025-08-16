-- Create characters table with proper constraints
CREATE TABLE IF NOT EXISTS public.characters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    visibility VARCHAR(10) NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    -- Store relative storage paths like: public/<user_uuid>/avatar.png or private/<user_uuid>/avatar.png
    avatar_url TEXT CHECK (
        avatar_url IS NULL OR
        avatar_url ~ '^(public|private)/[0-9a-fA-F-]{36}/[^\s]+'
    ),
    character_version INT DEFAULT 1 NOT NULL,
    is_nsfw BOOLEAN DEFAULT false NOT NULL,

    name TEXT NOT NULL CHECK (length(trim(name)) >= 1 AND length(name) <= 100),
    description TEXT CHECK (description IS NULL OR length(description) <= 2000),
    personality TEXT CHECK (personality IS NULL OR length(personality) <= 2000),
    scenario TEXT CHECK (scenario IS NULL OR length(scenario) <= 2000),
    first_message TEXT CHECK (first_message IS NULL OR length(first_message) <= 2000),
    message_example TEXT CHECK (message_example IS NULL OR length(message_example) <= 2000),
    
    creator_notes TEXT CHECK (creator_notes IS NULL OR length(creator_notes) <= 2000),
    system_prompt TEXT NOT NULL CHECK (length(trim(system_prompt)) >= 1 AND length(system_prompt) <= 10000),
    post_history_instructions TEXT CHECK (post_history_instructions IS NULL OR length(post_history_instructions) <= 2000),
    alternate_greetings TEXT[] CHECK (alternate_greetings IS NULL OR array_length(alternate_greetings, 1) <= 20)    
);

CREATE OR REPLACE FUNCTION check_array_element_length(arr TEXT[], max_length INT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    arr IS NULL OR
    array_length(arr, 1) IS NULL OR
    array_length(arr, 1) <= 10 AND
    (SELECT bool_and(length(trim(elem)) <= max_length) FROM unnest(arr) AS elem)
  );
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.characters
  DROP CONSTRAINT IF EXISTS alternate_greetings_check,
  ADD CONSTRAINT alternate_greetings_check
  CHECK (check_array_element_length(alternate_greetings, 2000));
  
-- Create tags table with proper constraints
CREATE TABLE IF NOT EXISTS public.tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL CHECK (length(trim(name)) >= 1 AND length(name) <= 50),
    description TEXT CHECK (description IS NULL OR length(description) <= 500),
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create character_tags junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.character_tags (
    character_id UUID REFERENCES public.characters(id) ON DELETE CASCADE NOT NULL,
    tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (character_id, tag_id)
);

-- Add character_id column to chats table
ALTER TABLE public.chat ADD COLUMN IF NOT EXISTS character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL;

-- Create a single character-avatars storage bucket (public); folder-level policies control access
-- Files are stored as: public/<user_id>/avatar.png or private/<user_id>/avatar.png
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'character-avatars',
    'character-avatars',
    true,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for the single avatars bucket using folder-based access control
-- Allow authenticated users to upload to their own public or private folder
CREATE POLICY "Allow authenticated uploads to avatars" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'character-avatars'
        AND (storage.foldername(name))[1] IN ('public', 'private')
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

-- Allow authenticated users to update their own files
CREATE POLICY "Allow authenticated updates to avatars" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'character-avatars'
        AND (storage.foldername(name))[1] IN ('public', 'private')
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

-- Allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated deletes to avatars" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'character-avatars'
        AND (storage.foldername(name))[1] IN ('public', 'private')
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

-- Allow public read access to public folder
CREATE POLICY "Allow public read to public folder" ON storage.objects
    FOR SELECT
    TO public
    USING (
        bucket_id = 'character-avatars'
        AND (storage.foldername(name))[1] = 'public'
    );

-- Allow authenticated users to read their own private files
CREATE POLICY "Allow authenticated read to private folder" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'character-avatars'
        AND (storage.foldername(name))[1] = 'private'
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

-- Create indexes
CREATE INDEX IF NOT EXISTS characters_user_id_idx ON public.characters(user_id);
CREATE INDEX IF NOT EXISTS characters_visibility_idx ON public.characters(visibility);
CREATE INDEX IF NOT EXISTS characters_character_id_idx ON public.chat(character_id);

CREATE INDEX IF NOT EXISTS tags_name_idx ON public.tags(name);
CREATE INDEX IF NOT EXISTS character_tags_character_id_idx ON public.character_tags(character_id);
CREATE INDEX IF NOT EXISTS character_tags_tag_id_idx ON public.character_tags(tag_id);

-- Enable Row Level Security
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for characters
CREATE POLICY "Users can view their own characters" ON public.characters
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view public characters" ON public.characters
    FOR SELECT USING (visibility = 'public');

CREATE POLICY "Users can create their own characters" ON public.characters
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own characters" ON public.characters
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own characters" ON public.characters
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for tags (only admins can create/modify tags, users can only view)
CREATE POLICY "Users can view all tags" ON public.tags
    FOR SELECT USING (true);

-- Note: INSERT, UPDATE, DELETE policies are intentionally omitted
-- Only Supabase admins can create/modify tags through direct database access

-- RLS Policies for character_tags
CREATE POLICY "Users can view character tags for accessible characters" ON public.character_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.characters 
            WHERE characters.id = character_tags.character_id 
            AND (characters.user_id = auth.uid() OR characters.visibility = 'public')
        )
    );

CREATE POLICY "Users can manage character tags for their characters" ON public.character_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.characters 
            WHERE characters.id = character_tags.character_id 
            AND characters.user_id = auth.uid()
        )
    );

-- Create trigger to automatically update updated_at for characters
CREATE TRIGGER update_characters_updated_at
    BEFORE UPDATE ON public.characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();