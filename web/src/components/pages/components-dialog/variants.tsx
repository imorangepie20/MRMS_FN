"use client"

import * as React from "react"
import { CheckIcon, CopyIcon, Link2Icon, PlusIcon, SettingsIcon } from "lucide-react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

const LOREM =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."

// 1. Edit profile
export function EditProfileVariant() {
  const [name, setName] = React.useState("")
  const [username, setUsername] = React.useState("")
  return (
    <Dialog>
      <DialogTrigger render={<Button>Edit Profile</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-username">Username</Label>
            <Input
              id="edit-username"
              placeholder="@username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter showCloseButton>
          <DialogClose render={<Button />}>Save changes</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 2. Basic
export function BasicVariant() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Open</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>
            This is the dialog description. It provides context for the content below.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {LOREM}
        </p>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}

// 3. Scrollable
export function ScrollableVariant() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Open</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Terms</DialogTitle>
          <DialogDescription>
            Please read these terms before continuing.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto pr-1 text-sm text-muted-foreground space-y-3">
          {Array.from({ length: 10 }, (_, i) => (
            <p key={i}>{LOREM}</p>
          ))}
        </div>
        <DialogFooter showCloseButton>
          <DialogClose render={<Button />}>Accept</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 4. Sticky header
export function StickyHeaderVariant() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Open</Button>} />
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <div className="sticky top-0 z-10 bg-popover border-b border-border px-4 pt-4 pb-3">
          <DialogHeader>
            <DialogTitle>Sticky Header</DialogTitle>
            <DialogDescription>
              The header remains visible as you scroll through the content.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="max-h-72 overflow-y-auto px-4 py-3 text-sm text-muted-foreground space-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <p key={i}>{LOREM}</p>
          ))}
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-b-xl" showCloseButton>
          <DialogClose render={<Button />}>Got it</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 5. Sticky footer
export function StickyFooterVariant() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Open</Button>} />
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <DialogHeader>
            <DialogTitle>Sticky Footer</DialogTitle>
            <DialogDescription>
              The footer buttons stay pinned while the body scrolls.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="max-h-72 overflow-y-auto px-4 text-sm text-muted-foreground space-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <p key={i}>{LOREM}</p>
          ))}
        </div>
        <div className="sticky bottom-0 z-10 bg-popover">
          <DialogFooter className="mx-0 mb-0 rounded-b-xl" showCloseButton>
            <DialogClose render={<Button />}>Confirm</DialogClose>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 6. Confirmation
export function ConfirmationVariant() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive">Delete</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your
            data and remove it from our servers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button variant="destructive" />}>Delete</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 7. Sign in
export function SignInVariant() {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  return (
    <Dialog>
      <DialogTrigger render={<Button>Sign in</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>
            Enter your credentials to access your account.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signin-dialog-email">Email</Label>
            <Input
              id="signin-dialog-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signin-dialog-password">Password</Label>
            <Input
              id="signin-dialog-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>Or continue with</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full">
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </Button>
        </div>
        <DialogFooter>
          <DialogClose render={<Button className="w-full" />}>Sign in</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 8. Share
export function ShareVariant() {
  const [copied, setCopied] = React.useState(false)
  const link = "https://example.com/share/abc123"
  const people = [
    { name: "Alice", initials: "A", email: "alice@example.com" },
    { name: "Bob", initials: "B", email: "bob@example.com" },
    { name: "Carol", initials: "C", email: "carol@example.com" },
  ]

  function handleCopy() {
    void navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Share</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share link</DialogTitle>
          <DialogDescription>
            Anyone with this link can view the document.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Link2Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              readOnly
              value={link}
              className="pl-8 text-sm font-mono"
            />
          </div>
          <Button variant="outline" size="icon" onClick={handleCopy} aria-label="Copy link">
            {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            People with access
          </p>
          {people.map((p) => (
            <div key={p.email} className="flex items-center gap-2">
              <Avatar size="sm">
                <AvatarFallback>{p.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-none">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.email}</p>
              </div>
              <Badge variant="secondary" className="text-xs">Editor</Badge>
            </div>
          ))}
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}

// 9. Settings (tabs)
export function SettingsTabsVariant() {
  const [emailNotifs, setEmailNotifs] = React.useState(true)
  const [pushNotifs, setPushNotifs] = React.useState(false)
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline"><SettingsIcon className="size-4 mr-1" />Settings</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your account and notification preferences.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>
          <TabsContent value="account" className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-display-name">Display name</Label>
              <Input id="settings-display-name" defaultValue="John Doe" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-email">Email</Label>
              <Input id="settings-email" type="email" defaultValue="john@example.com" />
            </div>
          </TabsContent>
          <TabsContent value="notifications" className="mt-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">Email notifications</p>
                <p className="text-xs text-muted-foreground">Receive updates via email</p>
              </div>
              <Switch checked={emailNotifs} onCheckedChange={setEmailNotifs} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">Push notifications</p>
                <p className="text-xs text-muted-foreground">Receive push notifications</p>
              </div>
              <Switch checked={pushNotifs} onCheckedChange={setPushNotifs} />
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter showCloseButton>
          <DialogClose render={<Button />}>Save</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 10. Newsletter
export function NewsletterVariant() {
  const [email, setEmail] = React.useState("")
  return (
    <Dialog>
      <DialogTrigger render={<Button>Subscribe</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Subscribe</DialogTitle>
          <DialogDescription>
            Stay up to date with our latest news and updates.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newsletter-dialog-email">Email address</Label>
          <Input
            id="newsletter-dialog-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button className="w-full" />}>Subscribe</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 11. Form (new project)
export function FormVariant() {
  const [projectName, setProjectName] = React.useState("")
  const [description, setDescription] = React.useState("")
  return (
    <Dialog>
      <DialogTrigger render={<Button><PlusIcon className="size-4 mr-1" />New project</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new project.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              placeholder="My Awesome Project"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-framework">Framework</Label>
            <Select>
              <SelectTrigger id="project-framework" className="w-full">
                <SelectValue placeholder="Select a framework" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="next">Next.js</SelectItem>
                <SelectItem value="remix">Remix</SelectItem>
                <SelectItem value="astro">Astro</SelectItem>
                <SelectItem value="vite">Vite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              placeholder="What is this project about?"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter showCloseButton>
          <DialogClose render={<Button />}>Create project</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 12. Small
export function SmallVariant() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Small</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Small dialog</DialogTitle>
          <DialogDescription>
            A compact dialog suitable for quick confirmations or brief messages.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <DialogClose render={<Button />}>OK</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 13. Large
export function LargeVariant() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Large</Button>} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Large dialog</DialogTitle>
          <DialogDescription>
            A wider dialog for content that needs more horizontal space.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">Left column</p>
            <p className="text-sm text-muted-foreground">{LOREM.slice(0, 200)}</p>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">Right column</p>
            <p className="text-sm text-muted-foreground">{LOREM.slice(0, 200)}</p>
          </div>
        </div>
        <DialogFooter showCloseButton>
          <DialogClose render={<Button />}>Continue</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 14. Full screen
export function FullScreenVariant() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Full screen</Button>} />
      <DialogContent className="max-w-[95vw] h-[90vh] sm:max-w-[95vw] flex flex-col gap-0 p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <DialogTitle>Full screen dialog</DialogTitle>
            <DialogDescription className="mt-0.5">
              A near-full-screen dialog for immersive content.
            </DialogDescription>
          </div>
          <DialogClose render={<Button variant="outline" size="sm" />}>Close</DialogClose>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 text-sm text-muted-foreground space-y-3">
          {Array.from({ length: 12 }, (_, i) => (
            <p key={i}>{LOREM}</p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 15. With media
export function WithMediaVariant() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Preview</Button>} />
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <div className="h-48 bg-linear-to-br from-violet-500 via-purple-500 to-pink-500 flex items-center justify-center">
          <div className="rounded-full bg-white/20 p-6 backdrop-blur-sm">
            <div className="size-12 rounded-full bg-white/40" />
          </div>
        </div>
        <div className="px-4 pt-4 pb-0">
          <DialogHeader>
            <DialogTitle>Beautiful gradient</DialogTitle>
            <DialogDescription>
              A dialog with a media area at the top and a caption with actions below.
            </DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter className="px-4 pt-3" showCloseButton>
          <DialogClose render={<Button />}>Download</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 16. Nested
export function NestedVariant() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline">Open</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Outer dialog</DialogTitle>
          <DialogDescription>
            This is the first dialog. You can open a second nested dialog from here.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Click the button below to open a nested confirmation dialog on top of this one.
        </p>
        <Dialog>
          <DialogTrigger render={<Button variant="outline" className="w-full">Open nested dialog</Button>} />
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle>Nested dialog</DialogTitle>
              <DialogDescription>
                This is a nested dialog rendered on top of the outer dialog.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <DialogClose render={<Button />}>Confirm</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
