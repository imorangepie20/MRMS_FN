"use client";

import { LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/lib/hooks/use-user";


function initials(email: string | undefined | null): string {
  if (!email) return "?";
  const localPart = email.split("@")[0] ?? "";
  return localPart.slice(0, 2).toUpperCase() || "?";
}


export function UserMenu() {
  const router = useRouter();
  const { user } = useUser();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // 로그아웃 실패해도 로컬 cookie는 어차피 만료됨 — 그냥 진행
    }
    router.push("/login");
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="User menu"
        >
          <Avatar className="size-8">
            <AvatarFallback>{initials(user?.email)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">
              {user?.displayName ?? user?.email ?? "사용자"}
            </span>
            {user?.email && user?.displayName && (
              <span className="text-xs text-muted-foreground truncate">
                {user.email}
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <User className="mr-2 h-4 w-4" />
          프로필 (준비 중)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
