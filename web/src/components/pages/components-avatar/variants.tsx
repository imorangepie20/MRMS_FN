"use client"

import * as React from "react"
import {
  User,
  Camera,
  BadgeCheck,
  Settings,
  LogOut,
  Bell,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// ─── 1. No image (fallback) ───────────────────────────────────────────────────
export function NoImageFallbackVariant() {
  return (
    <Avatar>
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  )
}

// ─── 2. Rounded ──────────────────────────────────────────────────────────────
export function RoundedVariant() {
  return (
    <Avatar className="rounded-md after:rounded-md">
      <AvatarFallback className="rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
        JD
      </AvatarFallback>
    </Avatar>
  )
}

// ─── 3. Icon ─────────────────────────────────────────────────────────────────
export function IconVariant() {
  return (
    <Avatar>
      <AvatarFallback>
        <User className="size-4" />
      </AvatarFallback>
    </Avatar>
  )
}

// ─── 4. Colorful ─────────────────────────────────────────────────────────────
export function ColorfulVariant() {
  const avatars = [
    { initials: "AL", bg: "bg-rose-100 dark:bg-rose-900", text: "text-rose-700 dark:text-rose-300" },
    { initials: "MR", bg: "bg-amber-100 dark:bg-amber-900", text: "text-amber-700 dark:text-amber-300" },
    { initials: "SK", bg: "bg-emerald-100 dark:bg-emerald-900", text: "text-emerald-700 dark:text-emerald-300" },
    { initials: "TW", bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-700 dark:text-blue-300" },
    { initials: "PL", bg: "bg-violet-100 dark:bg-violet-900", text: "text-violet-700 dark:text-violet-300" },
  ]
  return (
    <div className="flex items-center gap-2">
      {avatars.map(({ initials, bg, text }) => (
        <Avatar key={initials}>
          <AvatarFallback className={cn(bg, text)}>{initials}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  )
}

// ─── 5. Status badge (online) ─────────────────────────────────────────────────
export function StatusBadgeOnlineVariant() {
  return (
    <Avatar>
      <AvatarFallback className="bg-slate-200 dark:bg-slate-700">KL</AvatarFallback>
      <AvatarBadge className="bg-emerald-500" />
    </Avatar>
  )
}

// ─── 6. Icon badge ────────────────────────────────────────────────────────────
export function IconBadgeVariant() {
  return (
    <Avatar size="lg">
      <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
        PR
      </AvatarFallback>
      <AvatarBadge className="bg-blue-600">
        <BadgeCheck className="text-white" />
      </AvatarBadge>
    </Avatar>
  )
}

// ─── 7. Number badge ─────────────────────────────────────────────────────────
export function NumberBadgeVariant() {
  return (
    <div className="relative inline-flex">
      <Avatar>
        <AvatarFallback className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
          NB
        </AvatarFallback>
      </Avatar>
      <Badge
        className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] leading-none"
      >
        6
      </Badge>
    </div>
  )
}

// ─── 8. With tooltip ──────────────────────────────────────────────────────────
export function WithTooltipVariant() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Avatar className="cursor-pointer">
              <AvatarFallback className="bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                SA
              </AvatarFallback>
            </Avatar>
          }
        />
        <TooltipContent>Sarah Anderson</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─── 9. Avatar group ─────────────────────────────────────────────────────────
export function AvatarGroupVariant() {
  return (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback className="bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300">AL</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">MR</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">SK</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">TW</AvatarFallback>
      </Avatar>
    </AvatarGroup>
  )
}

// ─── 10. Group + tooltip ──────────────────────────────────────────────────────
export function GroupWithTooltipVariant() {
  const members = [
    { initials: "AL", name: "Alice Lee", bg: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300" },
    { initials: "BK", name: "Bob Kim", bg: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
    { initials: "CN", name: "Clara Ng", bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
    { initials: "DW", name: "Dan Wu", bg: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  ]
  return (
    <TooltipProvider>
      <AvatarGroup>
        {members.map(({ initials, name, bg }) => (
          <Tooltip key={initials}>
            <TooltipTrigger
              render={
                <Avatar className="cursor-pointer">
                  <AvatarFallback className={bg}>{initials}</AvatarFallback>
                </Avatar>
              }
            />
            <TooltipContent>{name}</TooltipContent>
          </Tooltip>
        ))}
      </AvatarGroup>
    </TooltipProvider>
  )
}

// ─── 11. Overflow indicator ───────────────────────────────────────────────────
export function OverflowIndicatorVariant() {
  return (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback className="bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300">AL</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">MR</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">SK</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+4</AvatarGroupCount>
    </AvatarGroup>
  )
}

// ─── 12. Text + group ─────────────────────────────────────────────────────────
export function TextGroupVariant() {
  return (
    <div className="flex items-center gap-3">
      <AvatarGroup>
        <Avatar size="sm">
          <AvatarFallback className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">PL</AvatarFallback>
        </Avatar>
        <Avatar size="sm">
          <AvatarFallback className="bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300">AL</AvatarFallback>
        </Avatar>
        <Avatar size="sm">
          <AvatarFallback className="bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">SA</AvatarFallback>
        </Avatar>
        <AvatarGroupCount className="size-6 text-xs">+4</AvatarGroupCount>
      </AvatarGroup>
      <span className="text-sm text-muted-foreground">7 members</span>
    </div>
  )
}

// ─── 13. Dropdown menu ────────────────────────────────────────────────────────
export function DropdownMenuVariant() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            aria-label="Open user menu"
            className="h-auto rounded-full p-0"
          >
            <Avatar className="cursor-pointer">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                JD
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Bell className="size-4" />
          Notifications
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── 14. With popover ─────────────────────────────────────────────────────────
export function WithPopoverVariant() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            aria-label="Open profile card"
            className="h-auto rounded-full p-0"
          >
            <Avatar className="cursor-pointer">
              <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                EG
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <PopoverContent className="w-64">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              EG
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">Emma Garcia</span>
            <span className="text-xs text-muted-foreground">emma@example.com</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Senior Product Designer · San Francisco, CA
        </p>
        <Button size="sm" className="mt-3 w-full">
          View Profile
        </Button>
      </PopoverContent>
    </Popover>
  )
}

// ─── 15. Absolute icon ────────────────────────────────────────────────────────
export function AbsoluteIconVariant() {
  return (
    <div className="relative inline-flex">
      <Avatar size="lg">
        <AvatarFallback className="bg-slate-200 dark:bg-slate-700">RF</AvatarFallback>
      </Avatar>
      <button
        aria-label="Edit photo"
        className={cn(
          "absolute -right-1 -bottom-1 z-20 flex size-6 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground shadow-sm ring-2 ring-background",
          "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <Camera className="size-3" />
      </button>
    </div>
  )
}

// ─── 16. Loading state ────────────────────────────────────────────────────────
export function LoadingStateVariant() {
  const [loading, setLoading] = React.useState(false)

  const handleReload = () => {
    setLoading(true)
    const timer = setTimeout(() => setLoading(false), 1200)
    return () => clearTimeout(timer)
  }

  return (
    <div className="flex items-center gap-4">
      {loading ? (
        <Skeleton className="size-8 rounded-full" />
      ) : (
        <Avatar>
          <AvatarFallback className="bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300">
            LM
          </AvatarFallback>
        </Avatar>
      )}
      <Button size="sm" variant="outline" onClick={handleReload}>
        Reload
      </Button>
    </div>
  )
}

// ─── 17. Ring status ──────────────────────────────────────────────────────────
export function RingStatusVariant() {
  return (
    <div className="flex items-center gap-4">
      <Avatar className="ring-2 ring-emerald-500 ring-offset-2 ring-offset-background">
        <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
          ON
        </AvatarFallback>
      </Avatar>
      <Avatar className="ring-2 ring-amber-400 ring-offset-2 ring-offset-background">
        <AvatarFallback className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
          AW
        </AvatarFallback>
      </Avatar>
      <Avatar className="ring-2 ring-red-500 ring-offset-2 ring-offset-background">
        <AvatarFallback className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
          BY
        </AvatarFallback>
      </Avatar>
    </div>
  )
}

// ─── 18. With profile details ─────────────────────────────────────────────────
export function WithProfileDetailsVariant() {
  return (
    <div className="flex items-center gap-3">
      <Avatar size="lg">
        <AvatarFallback className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
          AP
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-sm font-medium leading-tight">Alex Park</span>
        <span className="text-xs text-muted-foreground">Engineering Lead</span>
      </div>
    </div>
  )
}

// ─── 19. Collaborators view ───────────────────────────────────────────────────
export function CollaboratorsViewVariant() {
  const team = [
    { initials: "JL", name: "Jamie Lee", role: "Designer", bg: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300" },
    { initials: "CS", name: "Chris Smith", role: "Developer", bg: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
    { initials: "MT", name: "Maya Torres", role: "Product", bg: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  ]
  return (
    <div className="flex flex-col gap-2">
      {team.map(({ initials, name, role, bg }) => (
        <div key={initials} className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback className={bg}>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{role}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 20. Multiple status types ────────────────────────────────────────────────
export function MultipleStatusTypesVariant() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <Avatar>
          <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">ON</AvatarFallback>
          <AvatarBadge className="bg-emerald-500" />
        </Avatar>
        <span className="text-[10px] text-muted-foreground">Online</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Avatar>
          <AvatarFallback className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">AW</AvatarFallback>
          <AvatarBadge className="bg-amber-400" />
        </Avatar>
        <span className="text-[10px] text-muted-foreground">Away</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Avatar>
          <AvatarFallback className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">BY</AvatarFallback>
          <AvatarBadge className="bg-red-500" />
        </Avatar>
        <span className="text-[10px] text-muted-foreground">Busy</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Avatar>
          <AvatarFallback className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">OF</AvatarFallback>
          <AvatarBadge className="bg-slate-400" />
        </Avatar>
        <span className="text-[10px] text-muted-foreground">Offline</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Avatar>
          <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">VR</AvatarFallback>
          <AvatarBadge className="bg-blue-500">
            <BadgeCheck className="text-white" />
          </AvatarBadge>
        </Avatar>
        <span className="text-[10px] text-muted-foreground">Verified</span>
      </div>
    </div>
  )
}

// ─── 21. Advanced composition ─────────────────────────────────────────────────
export function AdvancedCompositionVariant() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="relative inline-flex">
        <Avatar
          size="lg"
          className="ring-2 ring-violet-500 ring-offset-2 ring-offset-background"
        >
          <AvatarFallback className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
            CL
          </AvatarFallback>
        </Avatar>
        <AvatarBadge className="bg-emerald-500" />
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold leading-tight">Clara Liu</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            Pro
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">@clara · Online now</span>
      </div>
    </div>
  )
}
