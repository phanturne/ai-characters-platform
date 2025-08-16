import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Filter, Search } from 'lucide-react';
import { Suspense } from 'react';
import CharactersGrid from './components/characters-grid';

export default function CharactersPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Browse Characters
          </h1>
          <p className="text-muted-foreground">
            Discover amazing AI characters created by the community
          </p>
        </div>

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search characters..." className="pl-10" />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="size-4" />
          </Button>
        </div>
      </div>

      {/* Characters grid */}
      <Suspense fallback={<div>Loading characters...</div>}>
        <CharactersGrid />
      </Suspense>
    </div>
  );
}
