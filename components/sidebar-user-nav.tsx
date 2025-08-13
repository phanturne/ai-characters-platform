'use client';

import { ChevronUp } from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { useRouter } from 'next/navigation';
import { LoaderIcon } from './icons';
import { SignOutForm } from './sign-out-form';

export function SidebarUserNav() {
  const router = useRouter();
  const { user, userType, loading } = useSupabaseAuth();
  const { setTheme, resolvedTheme } = useTheme();

  const isGuest = userType === 'guest';

  if (loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent bg-background data-[state=open]:text-sidebar-accent-foreground h-10 justify-between">
            <div className="flex flex-row gap-2">
              <div className="size-6 bg-zinc-500/30 rounded-full animate-pulse" />
              <span className="bg-zinc-500/30 text-transparent rounded-md animate-pulse">
                Loading auth status
              </span>
            </div>
            <div className="animate-spin text-zinc-500">
              <LoaderIcon />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => router.push('/login')}
            className="data-[state=open]:bg-sidebar-accent bg-background data-[state=open]:text-sidebar-accent-foreground h-10"
          >
            <div className="size-6 bg-zinc-500/30 rounded-full" />
            <span>Sign in</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              data-testid="user-nav-button"
              className="data-[state=open]:bg-sidebar-accent bg-background data-[state=open]:text-sidebar-accent-foreground h-10"
            >
              <Image
                src={`https://avatar.vercel.sh/${user.email}`}
                alt={user.email ?? 'User Avatar'}
                width={24}
                height={24}
                className="rounded-full"
              />
              <span data-testid="user-email" className="truncate">
                {isGuest ? 'Guest' : user?.email}
              </span>
              <ChevronUp className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            data-testid="user-nav-menu"
            side="top"
            className="w-[--radix-popper-anchor-width]"
          >
            <DropdownMenuItem
              data-testid="user-nav-item-theme"
              className="cursor-pointer"
              onSelect={() =>
                setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
              }
            >
              {`Toggle ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
            </DropdownMenuItem>
            <DropdownMenuItem asChild data-testid="user-nav-item-auth">
              {isGuest ? (
                <button
                  type="button"
                  className="w-full cursor-pointer"
                  onClick={() => router.push('/login')}
                >
                  Login to your account
                </button>
              ) : (
                <SignOutForm />
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
