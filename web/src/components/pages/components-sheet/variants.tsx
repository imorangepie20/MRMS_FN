"use client"

import * as React from "react"
import {
  BellIcon,
  HomeIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

const LOREM =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."

// 1. Right (default) — canonical "Edit profile"
export function RightDefaultVariant() {
  const [name, setName] = React.useState("")
  const [username, setUsername] = React.useState("")
  return (
    <Sheet>
      <SheetTrigger render={<Button>Open Sheet</Button>} />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sheet-right-name">Name</Label>
            <Input
              id="sheet-right-name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sheet-right-username">Username</Label>
            <Input
              id="sheet-right-username"
              placeholder="@username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        </div>
        <SheetFooter>
          <SheetClose render={<Button className="w-full" />}>
            Save changes
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// 2. Left (navigation)
export function LeftNavigationVariant() {
  const navItems = [
    { icon: HomeIcon, label: "Home" },
    { icon: SettingsIcon, label: "Settings" },
    { icon: BellIcon, label: "Notifications" },
    { icon: UserIcon, label: "Profile" },
  ]
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">Open menu</Button>} />
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-2 flex-1">
          {navItems.map(({ icon: Icon, label }) => (
            <button
              key={label}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-left"
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
        <Separator />
        <div className="px-2 pb-2">
          <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors text-left">
            <LogOutIcon className="size-4 shrink-0" />
            Log out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// 3. Top
export function TopVariant() {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">Open top</Button>} />
      <SheetContent side="top">
        <SheetHeader>
          <SheetTitle>Announcement</SheetTitle>
          <SheetDescription>
            We&apos;ve just launched our new feature set. Check it out now and
            let us know what you think!
          </SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" />}>Dismiss</SheetClose>
          <SheetClose render={<Button />}>Learn more</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// 4. Bottom
export function BottomVariant() {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">Open bottom</Button>} />
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Quick actions</SheetTitle>
          <SheetDescription>
            Choose an action to perform on the selected item.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          <Button variant="outline" size="sm">
            Duplicate
          </Button>
          <Button variant="outline" size="sm">
            Archive
          </Button>
          <Button variant="outline" size="sm">
            Export
          </Button>
          <Button variant="destructive" size="sm">
            Delete
          </Button>
        </div>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" className="w-full" />}>
            Cancel
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// 5. Scrollable
export function ScrollableVariant() {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">Open</Button>} />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Long content</SheetTitle>
          <SheetDescription>
            This sheet contains a lot of scrollable content.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-3 text-sm text-muted-foreground">
          {Array.from({ length: 12 }, (_, i) => (
            <p key={i}>{LOREM}</p>
          ))}
        </div>
        <SheetFooter>
          <SheetClose render={<Button variant="outline" className="w-full" />}>
            Close
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// 6. Form (settings)
export function FormSettingsVariant() {
  const [emailNotifs, setEmailNotifs] = React.useState(true)
  const [marketing, setMarketing] = React.useState(false)
  const [displayName, setDisplayName] = React.useState("")
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline"><SettingsIcon className="size-4 mr-1" />Settings</Button>} />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Manage your notification and display preferences.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sheet-settings-name">Display name</Label>
            <Input
              id="sheet-settings-name"
              placeholder="Your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">Email notifications</p>
              <p className="text-xs text-muted-foreground">
                Receive updates via email
              </p>
            </div>
            <Switch
              checked={emailNotifs}
              onCheckedChange={setEmailNotifs}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">Marketing emails</p>
              <p className="text-xs text-muted-foreground">
                Receive product news and offers
              </p>
            </div>
            <Switch checked={marketing} onCheckedChange={setMarketing} />
          </div>
        </div>
        <SheetFooter>
          <SheetClose render={<Button className="w-full" />}>Save</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// 7. Edit profile (with Avatar)
export function EditProfileVariant() {
  const [name, setName] = React.useState("Jane Doe")
  const [email, setEmail] = React.useState("jane@example.com")
  const [bio, setBio] = React.useState("")
  return (
    <Sheet>
      <SheetTrigger render={<Button>Edit profile</Button>} />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>
            Update your personal information and bio.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">Profile photo</p>
              <p className="text-xs text-muted-foreground">
                JPG, GIF or PNG. Max 1MB.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sheet-profile-name">Name</Label>
            <Input
              id="sheet-profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sheet-profile-email">Email</Label>
            <Input
              id="sheet-profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sheet-profile-bio">Bio</Label>
            <textarea
              id="sheet-profile-bio"
              rows={3}
              placeholder="Tell us a little about yourself"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 resize-none"
            />
          </div>
        </div>
        <SheetFooter>
          <SheetClose render={<Button className="w-full" />}>
            Save changes
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// 8. User profile
export function UserProfileVariant() {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">View profile</Button>} />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>User profile</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col items-center gap-3 px-4 pt-2 text-center">
          <Avatar size="lg">
            <AvatarFallback>AK</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5">
            <p className="text-base font-semibold">Alex Kim</p>
            <p className="text-sm text-muted-foreground">@alexkim</p>
          </div>
          <div className="flex w-full justify-around rounded-lg border border-border bg-muted/30 px-4 py-3 text-center">
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-semibold">142</p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
            <Separator orientation="vertical" className="h-auto" />
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-semibold">4.8k</p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <Separator orientation="vertical" className="h-auto" />
            <div className="flex flex-col gap-0.5">
              <p className="text-base font-semibold">312</p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-left w-full">
            Full-stack developer passionate about open source. Building tools
            that make developers&apos; lives easier.
          </p>
        </div>
        <SheetFooter>
          <Button className="w-full">Follow</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
