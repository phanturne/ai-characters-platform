import { documentHandlersByArtifactKind } from '@/lib/artifacts/server';
import type { Database, SupabaseClient } from '@/lib/supabase/schema';
import { getDocumentById } from '@/lib/supabase/services';
import type { ChatMessage } from '@/lib/types';
import type { Session } from '@supabase/supabase-js';
import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';

interface UpdateDocumentProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  supabase: SupabaseClient<Database>;
}

export const updateDocument = ({
  session,
  dataStream,
  supabase,
}: UpdateDocumentProps) =>
  tool({
    description: 'Update a document with the given description.',
    inputSchema: z.object({
      id: z.string().describe('The ID of the document to update'),
      description: z
        .string()
        .describe('The description of changes that need to be made'),
    }),
    execute: async ({ id, description }) => {
      const document = await getDocumentById(supabase, { id });

      if (!document) {
        return {
          error: 'Document not found',
        };
      }

      dataStream.write({
        type: 'data-clear',
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      await documentHandler.onUpdateDocument({
        document,
        description,
        dataStream,
        session,
        supabase,
      });

      dataStream.write({ type: 'data-finish', data: null, transient: true });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content: 'The document has been updated successfully.',
      };
    },
  });
