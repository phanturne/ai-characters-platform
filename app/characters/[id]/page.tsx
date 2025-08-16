import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Character, Tag as CharacterTag } from '@/lib/supabase/schema';
import { createClient } from '@/lib/supabase/server';
import {
  getCharacterById,
  getTagsByCharacterId,
} from '@/lib/supabase/services/queries';
import { Calendar, Eye, EyeOff, Tag, User } from 'lucide-react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import CharacterActions from './components/character-actions';
import CharacterViewSkeleton from './components/character-view-skeleton';

interface CharacterPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CharacterPage({ params }: CharacterPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const character = await getCharacterById(supabase, { id });
    const tagsData = await getTagsByCharacterId(supabase, { characterId: id });

    if (!character) {
      notFound();
    }

    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Suspense fallback={<CharacterViewSkeleton />}>
          <CharacterView
            character={character}
            tags={
              tagsData.map((ct) => ct.tags).filter(Boolean) as CharacterTag[]
            }
          />
        </Suspense>
      </div>
    );
  } catch (error) {
    console.error('Failed to load character:', error);
    notFound();
  }
}

function CharacterView({
  character,
  tags,
}: {
  character: Character;
  tags: CharacterTag[];
}) {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Avatar */}
        <div className="w-full lg:size-80 h-80 lg:h-80 bg-muted rounded-lg overflow-hidden relative">
          {character.avatar_url ? (
            <Image
              src={character.avatar_url}
              alt={character.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="size-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
              <span className="text-8xl font-bold text-primary">
                {character.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            {character.is_nsfw && <Badge variant="destructive">NSFW</Badge>}
            <Badge
              variant={
                character.visibility === 'public' ? 'default' : 'secondary'
              }
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

        {/* Character Info */}
        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              {character.name}
            </h1>
            {character.description && (
              <p className="text-xl text-muted-foreground mt-2">
                {character.description}
              </p>
            )}
          </div>

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag: CharacterTag) => (
                <Badge key={tag.id} variant="secondary">
                  <Tag className="size-3 mr-1" />
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <User className="size-4" />
              <span>Version {character.character_version}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4" />
              <span>
                Created {new Date(character.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Actions */}
          <CharacterActions character={character} />
        </div>
      </div>

      <Separator />

      {/* Character Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personality */}
        {character.personality && (
          <Card>
            <CardHeader>
              <CardTitle>Personality</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {character.personality}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Scenario */}
        {character.scenario && (
          <Card>
            <CardHeader>
              <CardTitle>Scenario & Setting</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {character.scenario}
              </p>
            </CardContent>
          </Card>
        )}

        {/* First Message */}
        {character.first_message && (
          <Card>
            <CardHeader>
              <CardTitle>First Message</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed italic">
                &quot;{character.first_message}&quot;
              </p>
            </CardContent>
          </Card>
        )}

        {/* Message Example */}
        {character.message_example && (
          <Card>
            <CardHeader>
              <CardTitle>Message Example</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed italic">
                &quot;{character.message_example}&quot;
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Alternate Greetings */}
      {character.alternate_greetings &&
        character.alternate_greetings.length > 0 && (
          <>
            <Separator />
            <Card>
              <CardHeader>
                <CardTitle>Alternate Greetings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {character.alternate_greetings.map(
                    (greeting: string, index: number) => (
                      <div
                        key={`greeting-${index}-${greeting.substring(0, 10)}`}
                        className="p-3 bg-muted rounded-lg"
                      >
                        <p className="text-muted-foreground italic">
                          &quot;{greeting}&quot;
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

      {/* Creator Notes */}
      {character.creator_notes && (
        <>
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle>Creator Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">
                {character.creator_notes}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
