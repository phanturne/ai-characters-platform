'use client';

import { useRouter } from 'next/navigation';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { cn } from '@/lib/utils';
import { Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

export function AppSidebar() {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { user } = useSupabaseAuth();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row gap-3 items-center"
            >
              <span className="text-lg font-semibold px-2 hover:bg-muted rounded-md cursor-pointer">
                Chatbot
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="p-2 h-fit"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <PlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end">New Chat</TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory user={user || undefined} />
        {/* Add Characters section */}
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Characters
          </h2>
          <div className="space-y-1">
            <Link
              href="/characters"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'w-full justify-start',
              )}
            >
              <Users className="size-4 mr-2" />
              Browse Characters
            </Link>
            <Link
              href="/characters/my"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'w-full justify-start',
              )}
            >
              <Settings className="size-4 mr-2" />
              My Characters
            </Link>
          </div>
        </div>
      </SidebarContent>
      <SidebarFooter>{user && <SidebarUserNav />}</SidebarFooter>
    </Sidebar>
  );
}
