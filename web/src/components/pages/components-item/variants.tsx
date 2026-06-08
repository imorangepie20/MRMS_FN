"use client"

import * as React from "react"
import {
  ChevronRight,
  Mail,
  MoreHorizontal,
  Music,
  Plus,
  ShieldAlert,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"

// ─── 1. Basic ────────────────────────────────────────────────────────────────
export function BasicVariant() {
  return (
    <Item>
      <ItemContent>
        <ItemTitle>Basic Item</ItemTitle>
        <ItemDescription>
          A simple item with a title and description.
        </ItemDescription>
      </ItemContent>
    </Item>
  )
}

// ─── 2. Default ──────────────────────────────────────────────────────────────
export function DefaultVariant() {
  return (
    <Item variant="default">
      <ItemContent>
        <ItemTitle>Default Item</ItemTitle>
        <ItemDescription>
          Transparent background with no border.
        </ItemDescription>
      </ItemContent>
    </Item>
  )
}

// ─── 3. Outline ──────────────────────────────────────────────────────────────
export function OutlineVariant() {
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>Outline Item</ItemTitle>
        <ItemDescription>
          A bordered item with an outline style.
        </ItemDescription>
      </ItemContent>
    </Item>
  )
}

// ─── 4. Muted ────────────────────────────────────────────────────────────────
export function MutedVariant() {
  return (
    <Item variant="muted">
      <ItemContent>
        <ItemTitle>Muted Item</ItemTitle>
        <ItemDescription>
          An item with a muted background.
        </ItemDescription>
      </ItemContent>
    </Item>
  )
}

// ─── 5. Alert ────────────────────────────────────────────────────────────────
export function AlertVariant() {
  return (
    <Item variant="outline">
      <ItemMedia variant="icon">
        <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <ShieldAlert className="size-5" />
        </div>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Security alert</ItemTitle>
        <ItemDescription>
          New sign-in from an unrecognized device.
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline">
          Review
        </Button>
      </ItemActions>
    </Item>
  )
}

// ─── 6. Avatar ───────────────────────────────────────────────────────────────
export function AvatarVariant() {
  return (
    <Item variant="outline">
      <ItemMedia>
        <Avatar>
          <AvatarFallback>ER</AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Emily Rose</ItemTitle>
        <ItemDescription>emily@example.com</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="icon-sm" variant="ghost" aria-label="More options">
          <MoreHorizontal />
        </Button>
      </ItemActions>
    </Item>
  )
}

// ─── 7. Action ───────────────────────────────────────────────────────────────
export function ActionVariant() {
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>No team members</ItemTitle>
        <ItemDescription>
          Invite people to collaborate on this project.
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm">
          <Plus />
          Invite
        </Button>
      </ItemActions>
    </Item>
  )
}

// ─── 8. Media / Image ────────────────────────────────────────────────────────
export function MediaVariant() {
  return (
    <Item variant="outline">
      <ItemMedia variant="image">
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
          <Music className="size-5" />
        </div>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Midnight City</ItemTitle>
        <ItemDescription>M83 · Hurry Up, We&apos;re Dreaming</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="icon-sm" variant="ghost" aria-label="Next">
          <ChevronRight />
        </Button>
      </ItemActions>
    </Item>
  )
}

// ─── 9. User list ────────────────────────────────────────────────────────────
const USERS = [
  { initials: "AL", name: "Alex Lee",     email: "alex@example.com" },
  { initials: "JK", name: "Jamie Kim",    email: "jamie@example.com" },
  { initials: "MS", name: "Morgan Smith", email: "morgan@example.com" },
]

export function UserListVariant() {
  return (
    <ItemGroup>
      {USERS.map((user, idx) => (
        <React.Fragment key={user.email}>
          <Item>
            <ItemMedia>
              <Avatar>
                <AvatarFallback>{user.initials}</AvatarFallback>
              </Avatar>
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{user.name}</ItemTitle>
              <ItemDescription>{user.email}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button size="icon-sm" variant="ghost" aria-label={`Mail ${user.name}`}>
                <Mail />
              </Button>
            </ItemActions>
          </Item>
          {idx < USERS.length - 1 && <ItemSeparator />}
        </React.Fragment>
      ))}
    </ItemGroup>
  )
}

// ─── 10. Feature ─────────────────────────────────────────────────────────────
export function FeatureVariant() {
  return (
    <Item variant="outline" render={<a href="#" />}>
      <ItemMedia variant="icon">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Music className="size-5" />
        </div>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Documentation</ItemTitle>
        <ItemDescription>Learn how to integrate.</ItemDescription>
      </ItemContent>
      <ItemActions>
        <ChevronRight className="size-4 text-muted-foreground" />
      </ItemActions>
    </Item>
  )
}
