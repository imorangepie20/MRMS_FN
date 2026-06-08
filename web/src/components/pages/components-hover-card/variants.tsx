"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"

import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

// ─── 1. Basic ─────────────────────────────────────────────────────────────────
export function BasicVariant() {
  return (
    <HoverCard>
      <HoverCardTrigger render={<Button variant="link">@nextjs</Button>} />
      <HoverCardContent className="w-80">
        <div className="flex gap-4">
          <Avatar>
            <AvatarFallback>VC</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">@nextjs</p>
            <p className="text-sm font-bold">Next.js</p>
            <p className="text-sm text-muted-foreground">
              The React Framework – created and maintained by @vercel.
            </p>
            <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" />
              <span>Joined December 2021</span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

// ─── 2. User profile ──────────────────────────────────────────────────────────
export function UserProfileVariant() {
  return (
    <HoverCard>
      <HoverCardTrigger render={<Button variant="link">@tobybelhome</Button>} />
      <HoverCardContent className="w-80">
        <div className="flex gap-4">
          <Avatar>
            <AvatarFallback>TB</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold">Toby Belhome</p>
            <p className="text-xs text-muted-foreground">@tobybelhome</p>
            <p className="text-sm text-muted-foreground">
              Product designer building tools for creative teams. Open source
              enthusiast.
            </p>
            <div className="flex gap-4 pt-1 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">412</span>{" "}
                followers
              </span>
              <span>
                <span className="font-semibold text-foreground">198</span>{" "}
                following
              </span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

// ─── 3. Stats and actions ─────────────────────────────────────────────────────
export function StatsActionsVariant() {
  return (
    <HoverCard>
      <HoverCardTrigger render={<Button variant="link">@sarahlane</Button>} />
      <HoverCardContent className="w-72">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>SL</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-bold">Sarah Lane</p>
              <p className="text-xs text-muted-foreground">@sarahlane</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-lg border p-2 text-center text-xs">
            <div>
              <p className="font-semibold text-foreground">84</p>
              <p className="text-muted-foreground">Posts</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">3.2k</p>
              <p className="text-muted-foreground">Followers</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">261</p>
              <p className="text-muted-foreground">Following</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1">
              Follow
            </Button>
            <Button size="sm" variant="outline" className="flex-1">
              View Profile
            </Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
