import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Filter, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import MyCharactersGrid from './components/my-characters-grid';

export default function MyCharactersPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Characters</h1>
          <p className="text-muted-foreground">
            Manage and edit your AI characters
          </p>
        </div>
        <Link href="/characters/create">
          <Button>
            <Plus className="size-4 mr-2" />
            Create Character
          </Button>
        </Link>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search your characters..." className="pl-10" />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="size-4" />
        </Button>
      </div>

      {/* Characters grid */}
      <Suspense fallback={<MyCharactersGridSkeleton />}>
        <MyCharactersGrid />
      </Suspense>
    </div>
  );
}

function MyCharactersGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={`my-character-skeleton-${i}-${Math.random()}`}
          className="border rounded-lg p-4 space-y-4"
        >
          <div className="flex items-center space-x-4">
            <div className="size-16 bg-muted rounded-full" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-2/3 bg-muted rounded" />
          </div>
          <div className="flex justify-between">
            <div className="h-8 w-20 bg-muted rounded" />
            <div className="h-8 w-20 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
