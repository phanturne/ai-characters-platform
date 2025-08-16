'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import type { Tag as CharacterTag } from '@/lib/supabase/schema';
import {
  createCharacterWithTagValidation,
  getAllTags,
} from '@/lib/supabase/services/queries';
import { Plus, Save, Tag, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface CharacterFormData {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  messageExample: string;
  creatorNotes: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  alternateGreetings: string[];
  isNsfw: boolean;
  visibility: 'public' | 'private';
  tagIds: string[];
}

export default function CreateCharacterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState<CharacterTag[]>([]);
  const [formData, setFormData] = useState<CharacterFormData>({
    name: '',
    description: '',
    personality: '',
    scenario: '',
    firstMessage: '',
    messageExample: '',
    creatorNotes: '',
    systemPrompt: '',
    postHistoryInstructions: '',
    alternateGreetings: [''],
    isNsfw: false,
    visibility: 'private',
    tagIds: [],
  });

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const supabase = createClient();
      const allTags = await getAllTags(supabase);
      setTags(allTags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleInputChange = (field: keyof CharacterFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAlternateGreetingChange = (index: number, value: string) => {
    const newGreetings = [...formData.alternateGreetings];
    newGreetings[index] = value;
    setFormData((prev) => ({ ...prev, alternateGreetings: newGreetings }));
  };

  const addAlternateGreeting = () => {
    setFormData((prev) => ({
      ...prev,
      alternateGreetings: [...prev.alternateGreetings, ''],
    }));
  };

  const removeAlternateGreeting = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      alternateGreetings: prev.alternateGreetings.filter((_, i) => i !== index),
    }));
  };

  const handleTagToggle = (tagId: string) => {
    setFormData((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Filter out empty alternate greetings
      const filteredGreetings = formData.alternateGreetings.filter((greeting) =>
        greeting.trim(),
      );

      const character = await createCharacterWithTagValidation(supabase, {
        userId: user.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        personality: formData.personality.trim() || null,
        scenario: formData.scenario.trim() || null,
        firstMessage: formData.firstMessage.trim() || null,
        messageExample: formData.messageExample.trim() || null,
        creatorNotes: formData.creatorNotes.trim() || null,
        systemPrompt: formData.systemPrompt.trim(),
        postHistoryInstructions:
          formData.postHistoryInstructions.trim() || null,
        alternateGreetings:
          filteredGreetings.length > 0 ? filteredGreetings : null,
        isNsfw: formData.isNsfw,
        visibility: formData.visibility,
        tagIds: formData.tagIds,
      });

      router.push(`/characters/${character.id}`);
    } catch (error) {
      console.error('Failed to create character:', error);
      alert('Failed to create character. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Character</h1>
        <p className="text-muted-foreground">
          Bring your AI character to life with personality, backstory, and
          conversation style
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Character Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter character name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value: 'public' | 'private') =>
                    handleInputChange('visibility', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  handleInputChange('description', e.target.value)
                }
                placeholder="Brief description of your character"
                rows={3}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {formData.description.length}/2000 characters
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isNsfw"
                checked={formData.isNsfw}
                onChange={(e) => handleInputChange('isNsfw', e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="isNsfw">Mark as NSFW content</Label>
            </div>
          </CardContent>
        </Card>

        {/* Personality & Backstory */}
        <Card>
          <CardHeader>
            <CardTitle>Personality & Backstory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="personality">Personality</Label>
              <Textarea
                id="personality"
                value={formData.personality}
                onChange={(e) =>
                  handleInputChange('personality', e.target.value)
                }
                placeholder="Describe the character's personality, traits, and behavior"
                rows={4}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {formData.personality.length}/2000 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scenario">Scenario/Setting</Label>
              <Textarea
                id="scenario"
                value={formData.scenario}
                onChange={(e) => handleInputChange('scenario', e.target.value)}
                placeholder="Describe the world, setting, or scenario where this character exists"
                rows={4}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {formData.scenario.length}/2000 characters
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Conversation Style */}
        <Card>
          <CardHeader>
            <CardTitle>Conversation Style</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstMessage">First Message</Label>
              <Textarea
                id="firstMessage"
                value={formData.firstMessage}
                onChange={(e) =>
                  handleInputChange('firstMessage', e.target.value)
                }
                placeholder="The first message this character will send when starting a conversation"
                rows={3}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {formData.firstMessage.length}/2000 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="messageExample">Message Example</Label>
              <Textarea
                id="messageExample"
                value={formData.messageExample}
                onChange={(e) =>
                  handleInputChange('messageExample', e.target.value)
                }
                placeholder="An example of how this character typically responds"
                rows={3}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {formData.messageExample.length}/2000 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label>Alternate Greetings</Label>
              <div className="space-y-2">
                {formData.alternateGreetings.map((greeting, index) => (
                  <div
                    key={`greeting-${index}-${greeting.length}`}
                    className="flex gap-2"
                  >
                    <Textarea
                      value={greeting}
                      onChange={(e) =>
                        handleAlternateGreetingChange(index, e.target.value)
                      }
                      placeholder="Alternative greeting message"
                      rows={2}
                      maxLength={2000}
                    />
                    {formData.alternateGreetings.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeAlternateGreeting(index)}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addAlternateGreeting}
                  className="w-full"
                >
                  <Plus className="size-4 mr-2" />
                  Add Greeting
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>AI Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt *</Label>
              <Textarea
                id="systemPrompt"
                value={formData.systemPrompt}
                onChange={(e) =>
                  handleInputChange('systemPrompt', e.target.value)
                }
                placeholder="Detailed instructions for how the AI should behave as this character"
                rows={6}
                maxLength={10000}
                required
              />
              <p className="text-xs text-muted-foreground">
                {formData.systemPrompt.length}/10000 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="postHistoryInstructions">
                Post-History Instructions
              </Label>
              <Textarea
                id="postHistoryInstructions"
                value={formData.postHistoryInstructions}
                onChange={(e) =>
                  handleInputChange('postHistoryInstructions', e.target.value)
                }
                placeholder="Instructions for how the character should behave after reading chat history"
                rows={3}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {formData.postHistoryInstructions.length}/2000 characters
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={
                    formData.tagIds.includes(tag.id) ? 'default' : 'outline'
                  }
                  className="cursor-pointer hover:opacity-80"
                  onClick={() => handleTagToggle(tag.id)}
                >
                  <Tag className="size-3 mr-1" />
                  {tag.name}
                </Badge>
              ))}
            </div>
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                No tags available. Tags will be managed by administrators.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Creator Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Creator Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="creatorNotes">Notes</Label>
              <Textarea
                id="creatorNotes"
                value={formData.creatorNotes}
                onChange={(e) =>
                  handleInputChange('creatorNotes', e.target.value)
                }
                placeholder="Any additional notes or instructions for yourself"
                rows={3}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {formData.creatorNotes.length}/2000 characters
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            <Save className="size-4 mr-2" />
            {loading ? 'Creating...' : 'Create Character'}
          </Button>
        </div>
      </form>
    </div>
  );
}
