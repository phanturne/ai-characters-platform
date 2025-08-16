import { Button } from '@/components/ui/button';
import { Home, Settings, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';

export default function CharactersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2">
                <Home className="size-6" />
                <span className="text-xl font-bold">AI Characters</span>
              </Link>
            </div>
            <nav className="flex items-center space-x-2">
              <Link href="/characters">
                <Button variant="ghost" size="sm">
                  <Users className="size-4 mr-2" />
                  Browse
                </Button>
              </Link>
              <Link href="/characters/my">
                <Button variant="ghost" size="sm">
                  <Settings className="size-4 mr-2" />
                  My Characters
                </Button>
              </Link>
              <Link href="/characters/create">
                <Button size="sm">
                  <UserPlus className="size-4 mr-2" />
                  Create Character
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
