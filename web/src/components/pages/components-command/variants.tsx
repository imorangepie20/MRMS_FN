"use client"

import * as React from "react"
import {
  Calculator,
  Calendar,
  Smile,
  User,
  CreditCard,
  Settings,
  Search,
  Mail,
  MessageSquare,
  Plus,
  FileText,
  Users,
  Bell,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ─── 1. Basic grouped ─────────────────────────────────────────────────────────
export function BasicGroupedVariant() {
  return (
    <div
      data-testid="command-basic"
      className="rounded-lg border overflow-hidden"
    >
      <Command>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem value="home">Home</CommandItem>
            <CommandItem value="dashboard">Dashboard</CommandItem>
            <CommandItem value="settings">Settings</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem value="new-file">New file</CommandItem>
            <CommandItem value="new-task">New task</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Files">
            <CommandItem value="documents">Documents</CommandItem>
            <CommandItem value="images">Images</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}

// ─── 2. Dialog (⌘K) ──────────────────────────────────────────────────────────
export function DialogVariant() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <div data-testid="command-dialog">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Press ⌘K
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Command Palette</DialogTitle>
            <DialogDescription>Search for commands and actions.</DialogDescription>
          </DialogHeader>
          <Command>
            <CommandInput placeholder="Type a command or search…" />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Suggestions">
                <CommandItem value="calendar">
                  <Calendar />
                  Calendar
                  <CommandShortcut>⌘P</CommandShortcut>
                </CommandItem>
                <CommandItem value="search-emoji">
                  <Smile />
                  Search Emoji
                  <CommandShortcut>⌘B</CommandShortcut>
                </CommandItem>
                <CommandItem value="calculator">
                  <Calculator />
                  Calculator
                  <CommandShortcut>⌘S</CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Settings">
                <CommandItem value="profile">
                  <User />
                  Profile
                  <CommandShortcut>⌘P</CommandShortcut>
                </CommandItem>
                <CommandItem value="billing">
                  <CreditCard />
                  Billing
                  <CommandShortcut>⌘B</CommandShortcut>
                </CommandItem>
                <CommandItem value="settings-item">
                  <Settings />
                  Settings
                  <CommandShortcut>⌘S</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── 3. Settings groups ───────────────────────────────────────────────────────
export function SettingsGroupsVariant() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Command>
        <CommandInput placeholder="Search settings…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="General">
            <CommandItem value="appearance">Appearance</CommandItem>
            <CommandItem value="language">Language</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Notifications">
            <CommandItem value="email-notifications">Email notifications</CommandItem>
            <CommandItem value="push-notifications">Push notifications</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Language">
            <CommandItem value="locale">Locale</CommandItem>
            <CommandItem value="timezone">Timezone</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Security">
            <CommandItem value="two-factor">Two-factor auth</CommandItem>
            <CommandItem value="sessions">Active sessions</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}

// ─── 4. Keyboard shortcuts ────────────────────────────────────────────────────
export function KeyboardShortcutsVariant() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Command>
        <CommandInput placeholder="Search shortcuts…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem value="home-shortcut">
              Home
              <CommandShortcut>⌘H</CommandShortcut>
            </CommandItem>
            <CommandItem value="dashboard-shortcut">
              Dashboard
              <CommandShortcut>⌘D</CommandShortcut>
            </CommandItem>
            <CommandItem value="search-shortcut">
              Search
              <CommandShortcut>⌘K</CommandShortcut>
            </CommandItem>
            <CommandItem value="settings-shortcut">
              Settings
              <CommandShortcut>⌘,</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}

// ─── 5. With icons ────────────────────────────────────────────────────────────
export function WithIconsVariant() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Command>
        <CommandInput placeholder="Search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Inbox">
            <CommandItem value="inbox">
              <Mail />
              Inbox
            </CommandItem>
            <CommandItem value="messages">
              <MessageSquare />
              Messages
            </CommandItem>
            <CommandItem value="team">
              <Users />
              Team
            </CommandItem>
            <CommandItem value="notifications">
              <Bell />
              Notifications
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}

// ─── 6. Search with tabs ──────────────────────────────────────────────────────
type TabFilter = "all" | "files" | "people" | "commands"

export function SearchWithTabsVariant() {
  const [tab, setTab] = React.useState<TabFilter>("all")

  return (
    <div className="rounded-lg border overflow-hidden">
      <Command>
        <CommandInput placeholder="Search…" />
        <div className="border-b px-2 py-1.5">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as TabFilter)}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="people">People</TabsTrigger>
              <TabsTrigger value="commands">Commands</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {(tab === "all" || tab === "files") && (
            <CommandGroup heading="Files">
              <CommandItem value="report-pdf">
                <FileText />
                Report.pdf
              </CommandItem>
              <CommandItem value="notes-txt">
                <FileText />
                Notes.txt
              </CommandItem>
            </CommandGroup>
          )}
          {(tab === "all" || tab === "people") && (
            <CommandGroup heading="People">
              <CommandItem value="alice-smith">
                <User />
                Alice Smith
              </CommandItem>
              <CommandItem value="bob-jones">
                <User />
                Bob Jones
              </CommandItem>
            </CommandGroup>
          )}
          {(tab === "all" || tab === "commands") && (
            <CommandGroup heading="Commands">
              <CommandItem value="new-file-cmd">
                <Plus />
                New file
              </CommandItem>
              <CommandItem value="search-cmd">
                <Search />
                Search everywhere
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  )
}

// ─── 7. Recent ────────────────────────────────────────────────────────────────
export function RecentVariant() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Command>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Recent">
            <CommandItem value="my-inbox">My Inbox</CommandItem>
            <CommandItem value="add-new-task">Add new task</CommandItem>
            <CommandItem value="data-analyst-team">Data Analyst Team</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Suggestions">
            <CommandItem value="create-project">
              <Plus />
              Create project
            </CommandItem>
            <CommandItem value="browse-files">
              <FileText />
              Browse files
            </CommandItem>
            <CommandItem value="settings-suggestion">
              <Settings />
              Settings
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}

// ─── 8. Empty state ───────────────────────────────────────────────────────────
export function EmptyStateVariant() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Command>
        <CommandInput placeholder="Try searching something…" defaultValue="zzz-no-match" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Items">
            <CommandItem value="alpha">Alpha</CommandItem>
            <CommandItem value="beta">Beta</CommandItem>
            <CommandItem value="gamma">Gamma</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}

// ─── 9. User list ─────────────────────────────────────────────────────────────
const USERS = [
  { id: "1", name: "Alice Martin",    email: "alice@example.com",   initials: "AM", location: "New York" },
  { id: "2", name: "Bob Chen",        email: "bob@example.com",     initials: "BC", location: "San Francisco" },
  { id: "3", name: "Carol Nguyen",    email: "carol@example.com",   initials: "CN", location: "London" },
  { id: "4", name: "David Kim",       email: "david@example.com",   initials: "DK", location: "Seoul" },
  { id: "5", name: "Eva Rodriguez",   email: "eva@example.com",     initials: "ER", location: "Madrid" },
]

export function UserListVariant() {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Command>
        <CommandInput placeholder="Search users…" />
        <CommandList>
          <CommandEmpty>No users found.</CommandEmpty>
          <CommandGroup heading="Team members">
            {USERS.map((user) => (
              <CommandItem key={user.id} value={`${user.name} ${user.email} ${user.location}`}>
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    "bg-muted text-muted-foreground"
                  )}
                >
                  {user.initials}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{user.location}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}
