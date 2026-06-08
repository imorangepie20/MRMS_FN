import * as React from "react"

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// ─── 1. Tags (vertical) ───────────────────────────────────────────────────────
const TAGS = Array.from({ length: 50 }, (_, i) => "v1.2.0-beta." + (50 - i))

export function TagsVerticalVariant() {
  return (
    <ScrollArea className="h-72 rounded-md border">
      <div className="p-4">
        <h4 className="mb-4 text-sm font-medium leading-none">Tags</h4>
        {TAGS.map((tag, index) => (
          <React.Fragment key={tag}>
            <div className="text-sm">{tag}</div>
            {index < TAGS.length - 1 && <Separator className="my-2" />}
          </React.Fragment>
        ))}
      </div>
    </ScrollArea>
  )
}

// ─── 2. User list ─────────────────────────────────────────────────────────────
const USERS = [
  { initials: "AL", name: "Alice Larson",    email: "alice@example.com" },
  { initials: "BK", name: "Bob Kim",         email: "bob.kim@example.com" },
  { initials: "CM", name: "Clara Mitchell",  email: "clara.m@example.com" },
  { initials: "DW", name: "David Wang",      email: "david.wang@example.com" },
  { initials: "EH", name: "Eva Hernandez",   email: "eva.h@example.com" },
  { initials: "FJ", name: "Felix Johnson",   email: "f.johnson@example.com" },
  { initials: "GS", name: "Grace Smith",     email: "grace.s@example.com" },
  { initials: "HP", name: "Henry Park",      email: "h.park@example.com" },
  { initials: "IA", name: "Isla Anderson",   email: "i.anderson@example.com" },
  { initials: "JB", name: "James Brown",     email: "j.brown@example.com" },
  { initials: "KN", name: "Karen Nguyen",    email: "k.nguyen@example.com" },
  { initials: "LO", name: "Leo Ortiz",       email: "leo.o@example.com" },
  { initials: "MT", name: "Mia Taylor",      email: "mia.t@example.com" },
  { initials: "NC", name: "Noah Clark",      email: "n.clark@example.com" },
  { initials: "OL", name: "Olivia Lewis",    email: "o.lewis@example.com" },
]

export function UserListVariant() {
  return (
    <ScrollArea className="h-72 rounded-md border">
      <div className="p-4 flex flex-col gap-3">
        {USERS.map((user) => (
          <div key={user.email} className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{user.initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium leading-none">{user.name}</span>
              <span className="text-xs text-muted-foreground truncate">{user.email}</span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

// ─── 3. Sticky header feed ────────────────────────────────────────────────────
const FEED_GROUPS = [
  {
    label: "Today",
    items: [
      { title: "New comment on your post", time: "2 min ago", body: "Sarah replied to your thread about TypeScript generics." },
      { title: "Deployment succeeded", time: "14 min ago", body: "Production build v2.4.1 deployed to Vercel." },
      { title: "You were mentioned", time: "1 hr ago", body: "Alex tagged you in a discussion about API rate limits." },
    ],
  },
  {
    label: "Yesterday",
    items: [
      { title: "PR review requested", time: "Yesterday 4 pm", body: "Jordan asked you to review: feat/dark-mode." },
      { title: "Issue assigned", time: "Yesterday 11 am", body: "Bug #482: Scroll snapping on mobile was assigned to you." },
    ],
  },
  {
    label: "This Week",
    items: [
      { title: "Weekly digest", time: "Mon 9 am", body: "5 open PRs, 12 closed issues, 3 releases this week." },
      { title: "Team meeting recap", time: "Mon 8 am", body: "Notes from the sprint planning session are now available." },
      { title: "New teammate joined", time: "Sun 3 pm", body: "Welcome Riley Thompson to the Engineering team." },
    ],
  },
]

export function StickyHeaderFeedVariant() {
  return (
    <ScrollArea className="h-72 rounded-md border">
      {FEED_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="sticky top-0 z-10 bg-background px-4 py-2 text-xs font-semibold text-muted-foreground border-b">
            {group.label}
          </div>
          {group.items.map((item) => (
            <div key={item.title} className="flex flex-col gap-0.5 px-4 py-3 border-b last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{item.title}</span>
                <span className="text-xs text-muted-foreground shrink-0">{item.time}</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      ))}
    </ScrollArea>
  )
}

// ─── 4. Horizontal avatars ────────────────────────────────────────────────────
const AVATAR_PEOPLE = [
  { initials: "AL", name: "Alice" },
  { initials: "BK", name: "Bob" },
  { initials: "CM", name: "Clara" },
  { initials: "DW", name: "David" },
  { initials: "EH", name: "Eva" },
  { initials: "FJ", name: "Felix" },
  { initials: "GS", name: "Grace" },
  { initials: "HP", name: "Henry" },
  { initials: "IA", name: "Isla" },
  { initials: "JB", name: "James" },
  { initials: "KN", name: "Karen" },
  { initials: "LO", name: "Leo" },
]

export function HorizontalAvatarsVariant() {
  return (
    <ScrollArea className="w-full rounded-md border">
      <div className="flex w-max gap-4 p-4">
        {AVATAR_PEOPLE.map((person) => (
          <div key={person.name} className="flex w-16 flex-col items-center gap-2 shrink-0">
            <Avatar size="lg">
              <AvatarFallback>{person.initials}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-center text-muted-foreground">{person.name}</span>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

// ─── 5. Chat messages ─────────────────────────────────────────────────────────
const MESSAGES = [
  { from: "them", text: "Hey! Did you get a chance to look at the new design specs?", time: "10:01 AM" },
  { from: "me",   text: "Yes! Just went through them. They look really clean.", time: "10:02 AM" },
  { from: "them", text: "Glad you like it. Any concerns before we hand off to dev?", time: "10:03 AM" },
  { from: "me",   text: "The mobile nav breakpoint might need revisiting.", time: "10:04 AM" },
  { from: "them", text: "Good catch. I'll flag it for the team.", time: "10:05 AM" },
  { from: "me",   text: "Also the spacing on the card grid feels a bit tight at 768px.", time: "10:06 AM" },
  { from: "them", text: "Agreed — I'll bump the gap from 3 to 4.", time: "10:07 AM" },
  { from: "me",   text: "Perfect. Should be ready for review by EOD.", time: "10:08 AM" },
  { from: "them", text: "Sounds great. I'll ping you when it's up.", time: "10:09 AM" },
  { from: "me",   text: "Thanks! Talk soon.", time: "10:10 AM" },
]

export function ChatMessagesVariant() {
  return (
    <ScrollArea className="h-72 rounded-md border p-4">
      <div className="flex flex-col gap-3">
        {MESSAGES.map((msg, i) => (
          <div
            key={i}
            className={cn("flex flex-col gap-1 max-w-[75%]", msg.from === "me" ? "self-end items-end" : "self-start items-start")}
          >
            <div
              className={cn(
                "rounded-2xl px-3 py-2 text-sm",
                msg.from === "me"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              )}
            >
              {msg.text}
            </div>
            <span className="text-[10px] text-muted-foreground">{msg.time}</span>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

// ─── 6. Horizontal cards ──────────────────────────────────────────────────────
const GALLERY_CARDS = [
  { title: "Mountain Sunrise",  subtitle: "Landscape",   from: "from-orange-400",  to: "to-rose-500" },
  { title: "Ocean at Dusk",     subtitle: "Seascape",    from: "from-sky-400",     to: "to-indigo-600" },
  { title: "Forest Path",       subtitle: "Nature",      from: "from-emerald-400", to: "to-teal-600" },
  { title: "City Lights",       subtitle: "Urban",       from: "from-violet-500",  to: "to-purple-700" },
  { title: "Desert Dunes",      subtitle: "Arid",        from: "from-amber-400",   to: "to-orange-600" },
  { title: "Arctic Aurora",     subtitle: "Polar",       from: "from-cyan-400",    to: "to-blue-600" },
  { title: "Cherry Blossoms",   subtitle: "Floral",      from: "from-pink-300",    to: "to-rose-400" },
  { title: "Waterfall Mist",    subtitle: "Tropical",    from: "from-teal-400",    to: "to-cyan-600" },
]

export function HorizontalCardsVariant() {
  return (
    <ScrollArea className="w-full rounded-md border">
      <div className="flex w-max gap-4 p-4">
        {GALLERY_CARDS.map((card) => (
          <div key={card.title} className="w-40 shrink-0 flex flex-col overflow-hidden rounded-md border">
            <div className={cn("h-24 bg-gradient-to-br", card.from, card.to)} />
            <div className="flex flex-col gap-0.5 p-3">
              <span className="text-sm font-medium leading-tight">{card.title}</span>
              <span className="text-xs text-muted-foreground">{card.subtitle}</span>
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
