-- Initial schema migration from Drizzle to Supabase
-- This migration creates all tables based on the existing Drizzle schema
-- Note: User table is not needed as Supabase provides auth.users

-- Create Chat table
CREATE TABLE IF NOT EXISTS chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    title TEXT NOT NULL,
    user_id UUID NOT NULL,
    visibility VARCHAR(10) NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create Message table (current version)
CREATE TABLE IF NOT EXISTS message (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    chat_id UUID NOT NULL,
    role VARCHAR NOT NULL,
    parts JSONB NOT NULL,
    attachments JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create Vote table (current version)
CREATE TABLE IF NOT EXISTS vote (
    chat_id UUID NOT NULL,
    message_id UUID NOT NULL,
    is_upvoted BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT vote_pk PRIMARY KEY (chat_id, message_id)
);

-- Create Document table
CREATE TABLE IF NOT EXISTS document (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    kind VARCHAR(10) NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'code', 'image', 'sheet')),
    user_id UUID NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT document_pk PRIMARY KEY (id, created_at)
);

-- Create Suggestion table
CREATE TABLE IF NOT EXISTS suggestion (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    document_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    original_text TEXT NOT NULL,
    suggested_text TEXT NOT NULL,
    description TEXT,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT suggestion_pk PRIMARY KEY (id)
);

-- Create Stream table
CREATE TABLE IF NOT EXISTS stream (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT stream_pk PRIMARY KEY (id)
);

-- Add foreign key constraints
ALTER TABLE chat ADD CONSTRAINT chat_user_id_fk 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE message ADD CONSTRAINT message_chat_id_fk 
    FOREIGN KEY (chat_id) REFERENCES chat(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE vote ADD CONSTRAINT vote_chat_id_fk 
    FOREIGN KEY (chat_id) REFERENCES chat(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE vote ADD CONSTRAINT vote_message_id_fk 
    FOREIGN KEY (message_id) REFERENCES message(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE document ADD CONSTRAINT document_user_id_fk 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE suggestion ADD CONSTRAINT suggestion_document_id_document_created_at_fk 
    FOREIGN KEY (document_id, document_created_at) REFERENCES document(id, created_at) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE suggestion ADD CONSTRAINT suggestion_user_id_fk 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE stream ADD CONSTRAINT stream_chat_id_fk 
    FOREIGN KEY (chat_id) REFERENCES chat(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS chat_user_id_idx ON chat(user_id);
CREATE INDEX IF NOT EXISTS chat_visibility_idx ON chat(visibility);
CREATE INDEX IF NOT EXISTS message_chat_id_idx ON message(chat_id);
CREATE INDEX IF NOT EXISTS message_created_at_idx ON message(created_at);
CREATE INDEX IF NOT EXISTS vote_chat_id_idx ON vote(chat_id);
CREATE INDEX IF NOT EXISTS vote_message_id_idx ON vote(message_id);
CREATE INDEX IF NOT EXISTS document_user_id_idx ON document(user_id);
CREATE INDEX IF NOT EXISTS document_kind_idx ON document(kind);
CREATE INDEX IF NOT EXISTS suggestion_document_id_idx ON suggestion(document_id);
CREATE INDEX IF NOT EXISTS suggestion_user_id_idx ON suggestion(user_id);
CREATE INDEX IF NOT EXISTS suggestion_is_resolved_idx ON suggestion(is_resolved);
CREATE INDEX IF NOT EXISTS stream_chat_id_idx ON stream(chat_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_chat_updated_at BEFORE UPDATE ON chat FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_message_updated_at BEFORE UPDATE ON message FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vote_updated_at BEFORE UPDATE ON vote FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_document_updated_at BEFORE UPDATE ON document FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suggestion_updated_at BEFORE UPDATE ON suggestion FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stream_updated_at BEFORE UPDATE ON stream FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE message ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote ENABLE ROW LEVEL SECURITY;
ALTER TABLE document ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Chat policies
CREATE POLICY "Users can view their own chats" ON chat FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view public chats" ON chat FOR SELECT USING (visibility = 'public');
CREATE POLICY "Users can create chats" ON chat FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own chats" ON chat FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chats" ON chat FOR DELETE USING (auth.uid() = user_id);

-- Message policies
CREATE POLICY "Users can view messages in their chats" ON message FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat WHERE chat.id = message.chat_id AND chat.user_id = auth.uid())
);
CREATE POLICY "Users can view messages in public chats" ON message FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat WHERE chat.id = message.chat_id AND chat.visibility = 'public')
);
CREATE POLICY "Users can create messages in their chats" ON message FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM chat WHERE chat.id = message.chat_id AND chat.user_id = auth.uid())
);
CREATE POLICY "Users can update messages in their chats" ON message FOR UPDATE USING (
    EXISTS (SELECT 1 FROM chat WHERE chat.id = message.chat_id AND chat.user_id = auth.uid())
);
CREATE POLICY "Users can delete messages in their chats" ON message FOR DELETE USING (
    EXISTS (SELECT 1 FROM chat WHERE chat.id = message.chat_id AND chat.user_id = auth.uid())
);

-- Vote policies
CREATE POLICY "Users can view votes in their chats" ON vote FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat WHERE chat.id = vote.chat_id AND chat.user_id = auth.uid())
);
CREATE POLICY "Users can view votes in public chats" ON vote FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat WHERE chat.id = vote.chat_id AND chat.visibility = 'public')
);
CREATE POLICY "Users can create votes in their chats" ON vote FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM chat WHERE chat.id = vote.chat_id AND chat.user_id = auth.uid())
);
CREATE POLICY "Users can update their own votes" ON vote FOR UPDATE USING (
    EXISTS (SELECT 1 FROM chat WHERE chat.id = vote.chat_id AND chat.user_id = auth.uid())
);
CREATE POLICY "Users can delete their own votes" ON vote FOR DELETE USING (
    EXISTS (SELECT 1 FROM chat WHERE chat.id = vote.chat_id AND chat.user_id = auth.uid())
);

-- Document policies
CREATE POLICY "Users can view their own documents" ON document FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create documents" ON document FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own documents" ON document FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own documents" ON document FOR DELETE USING (auth.uid() = user_id);

-- Suggestion policies
CREATE POLICY "Users can view suggestions for their documents" ON suggestion FOR SELECT USING (
    EXISTS (SELECT 1 FROM document WHERE document.id = suggestion.document_id AND document.user_id = auth.uid())
);
CREATE POLICY "Users can create suggestions for their documents" ON suggestion FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM document WHERE document.id = suggestion.document_id AND document.user_id = auth.uid())
);
CREATE POLICY "Users can update suggestions for their documents" ON suggestion FOR UPDATE USING (
    EXISTS (SELECT 1 FROM document WHERE document.id = suggestion.document_id AND document.user_id = auth.uid())
);
CREATE POLICY "Users can delete suggestions for their documents" ON suggestion FOR DELETE USING (
    EXISTS (SELECT 1 FROM document WHERE document.id = suggestion.document_id AND document.user_id = auth.uid())
);

-- Stream policies
CREATE POLICY "Users can view streams in their chats" ON stream FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat WHERE chat.id = stream.chat_id AND chat.user_id = auth.uid())
);
CREATE POLICY "Users can create streams in their chats" ON stream FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM chat WHERE chat.id = stream.chat_id AND chat.user_id = auth.uid())
);
CREATE POLICY "Users can delete streams in their chats" ON stream FOR DELETE USING (
    EXISTS (SELECT 1 FROM chat WHERE chat.id = stream.chat_id AND chat.user_id = auth.uid())
); 