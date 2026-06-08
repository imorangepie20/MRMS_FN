"use client"

import * as React from "react"
import {
  User,
  CreditCard,
  Settings,
  Keyboard,
  Users,
  Plus,
  Mail,
  MessageSquare,
  PlusCircle,
  GitBranch,
  LifeBuoy,
  Cloud,
  LogOut,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"

// ─── 1. Basic ─────────────────────────────────────────────────────────────────
export function BasicVariant() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Open Menu</Button>} />
      <DropdownMenuContent>
        <DropdownMenuItem>New Tab</DropdownMenuItem>
        <DropdownMenuItem>New Window</DropdownMenuItem>
        <DropdownMenuItem>New Incognito Window</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── 2. With icons ────────────────────────────────────────────────────────────
export function WithIconsVariant() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Open Menu</Button>} />
      <DropdownMenuContent>
        <DropdownMenuItem>
          <User />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CreditCard />
          Billing
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Keyboard />
          Keyboard shortcuts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── 3. Grouped ───────────────────────────────────────────────────────────────
export function GroupedVariant() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Open Menu</Button>} />
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard />
            Billing
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Users />
            Team
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Plus />
            Invite users
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── 4. Labeled groups ────────────────────────────────────────────────────────
export function LabeledGroupsVariant() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Open Menu</Button>} />
      <DropdownMenuContent>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuItem>
          <User />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CreditCard />
          Billing
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Team</DropdownMenuLabel>
        <DropdownMenuItem>
          <Users />
          Team
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Plus />
          New Team
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── 5. Checkbox items ────────────────────────────────────────────────────────
export function CheckboxItemsVariant() {
  const [statusBar, setStatusBar] = React.useState(true)
  const [panel, setPanel] = React.useState(false)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Open Menu</Button>} />
      <DropdownMenuContent>
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={statusBar}
          onCheckedChange={setStatusBar}
        >
          Status Bar
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem disabled>
          Activity Bar
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={panel}
          onCheckedChange={setPanel}
        >
          Panel
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── 6. Radio items ───────────────────────────────────────────────────────────
export function RadioItemsVariant() {
  const [position, setPosition] = React.useState("bottom")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Open Menu</Button>} />
      <DropdownMenuContent>
        <DropdownMenuLabel>Panel Position</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={position} onValueChange={setPosition}>
          <DropdownMenuRadioItem value="top">Top</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="bottom">Bottom</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="right">Right</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── 7. With shortcuts ────────────────────────────────────────────────────────
export function WithShortcutsVariant() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Open Menu</Button>} />
      <DropdownMenuContent>
        <DropdownMenuItem>
          <User />
          Profile
          <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CreditCard />
          Billing
          <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Settings
          <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Plus />
          New Team
          <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── 8. With submenu ──────────────────────────────────────────────────────────
export function WithSubmenuVariant() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Open Menu</Button>} />
      <DropdownMenuContent>
        <DropdownMenuItem>
          <User />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Users />
            Invite users
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>
              <Mail />
              Email
            </DropdownMenuItem>
            <DropdownMenuItem>
              <MessageSquare />
              Message
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <PlusCircle />
              More…
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── 9. Account menu ──────────────────────────────────────────────────────────
export function AccountMenuVariant() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto rounded-full p-0"
            aria-label="Open account menu"
          >
            <Avatar>
              <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                SC
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">shadcn</span>
            <span className="text-xs font-normal text-muted-foreground">m@example.com</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User />
            Profile
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard />
            Billing
            <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings />
            Settings
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Keyboard />
            Keyboard shortcuts
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Users />
            Team
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Users />
              Invite users
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>
                <Mail />
                Email
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MessageSquare />
                Message
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <PlusCircle />
                More…
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem>
            <Plus />
            New Team
            <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <GitBranch />
          GitHub
        </DropdownMenuItem>
        <DropdownMenuItem>
          <LifeBuoy />
          Support
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Cloud />
          API
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <LogOut />
          Log out
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── 10. With disabled items ──────────────────────────────────────────────────
export function WithDisabledItemsVariant() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Open Menu</Button>} />
      <DropdownMenuContent>
        <DropdownMenuItem>
          <User />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <CreditCard />
          Billing
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Users />
          Team (unavailable)
        </DropdownMenuItem>
        <DropdownMenuItem>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── 11. Rich menu ────────────────────────────────────────────────────────────
export function RichMenuVariant() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Open Menu</Button>} />
      <DropdownMenuContent className="w-64">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar>
            <AvatarFallback className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
              JD
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">Jane Doe</span>
            <span className="text-xs text-muted-foreground">jane@example.com</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="flex-col items-start gap-0.5 py-2">
          <div className="flex items-center gap-1.5 font-medium">
            <Settings className="size-4" />
            Account settings
          </div>
          <span className="pl-5.5 text-xs text-muted-foreground">
            Manage your account preferences
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem className="flex-col items-start gap-0.5 py-2">
          <div className="flex items-center gap-1.5 font-medium">
            <Users className="size-4" />
            Team workspace
          </div>
          <span className="pl-5.5 text-xs text-muted-foreground">
            Collaborate with your teammates
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── 12. Scrollable ───────────────────────────────────────────────────────────
export function ScrollableVariant() {
  const items = [
    "Dashboard",
    "Analytics",
    "Reports",
    "Projects",
    "Tasks",
    "Calendar",
    "Messages",
    "Notifications",
    "Settings",
    "Billing",
    "Team",
    "Integrations",
    "API Keys",
    "Audit Log",
    "Support",
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Open Menu</Button>} />
      <DropdownMenuContent className="max-h-64 overflow-y-auto">
        {items.map((item) => (
          <DropdownMenuItem key={item}>{item}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
