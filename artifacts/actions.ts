'use server';

import { createClient } from '@/lib/supabase/server';
import { getSuggestionsByDocumentId } from '@/lib/supabase/services';

export async function getSuggestions({ documentId }: { documentId: string }) {
  const supabase = await createClient();
  const suggestions = await getSuggestionsByDocumentId(supabase, {
    documentId,
  });
  return suggestions ?? [];
}
