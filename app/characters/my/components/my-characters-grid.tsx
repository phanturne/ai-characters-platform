'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import type { Character, Tag as CharacterTag } from '@/lib/supabase/schema';
import {
  getAllTags,
  getCharactersByUserId,
} from '@/lib/supabase/services/queries';
import { Edit, Eye, EyeOff, Settings, Tag, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface CharacterWithTags extends Character {
  tags?: CharacterTag[];
}

export default function MyCharactersGrid() {
  const [characters, setCharacters] = useState<CharacterWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [tags, setTags] = useState<CharacterTag[]>([]);

  useEffect(() => {
    loadCharacters();
    loadTags();
  }, []);

  const loadCharacters = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const result = await getCharactersByUserId(supabase, {
        userId: user.id,
        limit: 20,
        startingAfter: null,
        endingBefore: null,
      });

      setCharacters(result.characters);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load characters:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const supabase = createClient();
      const allTags = await getAllTags(supabase);
      setTags(allTags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleDeleteCharacter = async (characterId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this character? This action cannot be undone.',
      )
    ) {
      return;
    }

    try {
      const supabase = createClient();
      // Note: You'll need to implement deleteCharacterById in your queries
      // await deleteCharacterById(supabase, { id: characterId });

      // Remove from local state
      setCharacters((prev) => prev.filter((char) => char.id !== characterId));
    } catch (error) {
      console.error('Failed to delete character:', error);
    }
  };

  if (loading && characters.length === 0) {
    return <MyCharactersGridSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Characters grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {characters.map((character) => (
          <MyCharacterCard
            key={character.id}
            character={character}
            tags={tags}
            onDelete={handleDeleteCharacter}
          />
        ))}
      </div>

      {/* Empty state */}
      {!loading && characters.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto size-24 bg-muted rounded-full flex items-center justify-center mb-4">
            <Settings className="size-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No characters yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first AI character to get started
          </p>
          <Link href="/characters/create">
            <Button>
              <Settings className="size-4 mr-2" />
              Create Character
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function MyCharacterCard({
  character,
  tags,
  onDelete,
}: {
  character: CharacterWithTags;
  tags: CharacterTag[];
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
      {/* Avatar */}
      <div className="aspect-square bg-muted relative overflow-hidden">
        {character.avatar_url ? (
          <Image
            src={character.avatar_url}
            alt={character.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="size-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
            <span className="text-4xl font-bold text-primary">
              {character.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Visibility and NSFW badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {character.is_nsfw && (
            <Badge variant="destructive" className="text-xs">
              NSFW
            </Badge>
          )}
          <Badge
            variant={
              character.visibility === 'public' ? 'default' : 'secondary'
            }
            className="text-xs"
          >
            {character.visibility === 'public' ? (
              <>
                <Eye className="size-3 mr-1" />
                Public
              </>
            ) : (
              <>
                <EyeOff className="size-3 mr-1" />
                Private
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <CardHeader className="p-4">
        <CardTitle className="text-lg line-clamp-1">{character.name}</CardTitle>
        {character.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {character.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="p-4 pt-0">
        {/* Tags */}
        {character.tags && character.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {character.tags.slice(0, 3).map((tag) => (
              <Badge key={tag.id} variant="secondary" className="text-xs">
                <Tag className="size-3 mr-1" />
                {tag.name}
              </Badge>
            ))}
            {character.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{character.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <span>Version {character.character_version}</span>
          <span>{new Date(character.created_at).toLocaleDateString()}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link href={`/characters/${character.id}/edit`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <Edit className="size-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(character.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MyCharactersGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card
          key={`my-character-skeleton-${i}-${Math.random()}`}
          className="overflow-hidden"
        >
          <div className="aspect-square bg-muted" />
          <CardHeader className="p-4">
            <div className="h-6 w-3/4 bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-4 w-full bg-muted rounded mb-2" />
            <div className="h-4 w-2/3 bg-muted rounded mb-4" />
            <div className="flex gap-2">
              <div className="h-8 flex-1 bg-muted rounded" />
              <div className="h-8 w-12 bg-muted rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
