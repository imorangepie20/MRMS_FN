"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { navGroups } from "@/lib/nav";
import { useUser } from "@/lib/hooks/use-user";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ROLE_RANK: Record<string, number> = { user: 0, admin: 1, superadmin: 2 };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { user } = useUser();
  // 사이드바와 동일한 역할 게이팅 — admin 메뉴를 권한 없는 유저에게 노출하지 않음
  const myRank = ROLE_RANK[user?.role ?? "user"] ?? 0;
  const visibleGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.minRole || myRank >= ROLE_RANK[i.minRole]),
    }))
    .filter((g) => g.items.length > 0);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start text-muted-foreground sm:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="ml-2">Search…</span>
        <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium sm:flex">
          ⌘K
        </kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Command Palette</DialogTitle>
            <DialogDescription>Search for a page to navigate to.</DialogDescription>
          </DialogHeader>
          <Command>
            <CommandInput placeholder="Type a page name…" />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              {visibleGroups.map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.href}
                      value={`${group.label} ${item.title}`}
                      onSelect={() => {
                        setOpen(false);
                        router.push(item.href);
                      }}
                    >
                      <span className="font-mono text-[10px] text-muted-foreground mr-2">{item.num}</span>
                      <span>{item.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
