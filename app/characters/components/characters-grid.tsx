'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import type { Character, Tag as CharacterTag } from '@/lib/supabase/schema';
import {
  getAllTags,
  getPublicCharacters,
} from '@/lib/supabase/services/queries';
import { Eye, MessageCircle, Tag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface CharacterWithTags extends Character {
  tags?: CharacterTag[];
}

export default function CharactersGrid() {
  const [characters, setCharacters] = useState<CharacterWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [tags, setTags] = useState<CharacterTag[]>([]);

  useEffect(() => {
    loadCharacters();
    loadTags();
  }, []);

  const loadCharacters = async () => {
    try {
      const supabase = createClient();
      const result = await getPublicCharacters(supabase, {
        limit: 12,
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

  const loadMore = async () => {
    if (!hasMore || loading) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const lastCharacter = characters[characters.length - 1];
      const result = await getPublicCharacters(supabase, {
        limit: 12,
        startingAfter: lastCharacter?.id || null,
        endingBefore: null,
      });

      setCharacters((prev) => [...prev, ...result.characters]);
      setHasMore(result.hasMore);
      setPage((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to load more characters:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && characters.length === 0) {
    return <CharactersGridSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Characters grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {characters.map((character) => (
          <CharacterCard key={character.id} character={character} tags={tags} />
        ))}
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center">
          <Button
            onClick={loadMore}
            disabled={loading}
            variant="outline"
            size="lg"
          >
            {loading ? 'Loading...' : 'Load More Characters'}
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && characters.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            No characters found. Be the first to create one!
          </p>
        </div>
      )}
    </div>
  );
}

function CharacterCard({
  character,
  tags,
}: {
  character: CharacterWithTags;
  tags: CharacterTag[];
}) {
  const getTagById = (id: string) => tags.find((tag) => tag.id === id);

  return (
    <Link href={`/characters/${character.id}`}>
      <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden">
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

          {/* NSFW badge */}
          {character.is_nsfw && (
            <Badge variant="destructive" className="absolute top-2 right-2">
              NSFW
            </Badge>
          )}
        </div>

        {/* Content */}
        <CardHeader className="p-4">
          <CardTitle className="text-lg line-clamp-1 group-hover:text-primary transition-colors">
            {character.name}
          </CardTitle>
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
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-4">
              <span className="flex items-center">
                <Eye className="size-3 mr-1" />
                {character.character_version}
              </span>
              <span className="flex items-center">
                <MessageCircle className="size-3 mr-1" />v
                {character.character_version}
              </span>
            </div>
            <span className="text-xs">
              {new Date(character.created_at).toLocaleDateString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CharactersGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card
          key={`character-skeleton-${i}-${Date.now()}`}
          className="overflow-hidden"
        >
          <div className="aspect-square bg-muted" />
          <CardHeader className="p-4">
            <div className="h-6 w-3/4 bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-4 w-full bg-muted rounded mb-2" />
            <div className="h-4 w-2/3 bg-muted rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
