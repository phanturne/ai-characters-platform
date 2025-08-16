'use client';

import { createCharacterChat } from '@/app/(chat)/actions';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import type { Character } from '@/lib/supabase/schema';
import { Edit, MessageCircle, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface CharacterActionsProps {
  character: Character;
}

export default function CharacterActions({ character }: CharacterActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    const checkUserPermissions = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && user.id === character.user_id) {
          setCanEdit(true);
        }
      } catch (error) {
        console.error('Failed to check user permissions:', error);
      } finally {
        setUserLoading(false);
      }
    };

    checkUserPermissions();
  }, [character.user_id]);

  const handleStartChat = async () => {
    setLoading(true);

    try {
      // Create a new chat with this character
      const { chatId } = await createCharacterChat(character.id);

      // Redirect to the new chat
      router.push(`/chat/${chatId}`);
    } catch (error) {
      console.error('Failed to start chat:', error);

      // If there's an error, redirect to login (user might not be authenticated)
      if (
        error instanceof Error &&
        error.message.includes('not authenticated')
      ) {
        router.push('/login');
      } else {
        // Show error to user
        alert('Failed to start chat. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (userLoading) {
    return (
      <div className="flex flex-wrap gap-3">
        <Button disabled size="lg" className="flex-1 sm:flex-none">
          <MessageCircle className="size-4 mr-2" />
          Loading...
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        onClick={handleStartChat}
        disabled={loading}
        size="lg"
        className="flex-1 sm:flex-none"
      >
        <MessageCircle className="size-4 mr-2" />
        {loading ? 'Starting...' : 'Start Chat'}
      </Button>

      {canEdit && (
        <Button variant="outline" size="lg" asChild>
          <a href={`/characters/${character.id}/edit`}>
            <Edit className="size-4 mr-2" />
            Edit Character
          </a>
        </Button>
      )}

      <Button variant="ghost" size="lg">
        <Settings className="size-4 mr-2" />
        More Options
      </Button>
    </div>
  );
}
