"use client"

import * as React from "react"
import { MinusIcon, PlusIcon, CookieIcon } from "lucide-react"

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
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
import { Textarea } from "@/components/ui/textarea"

const LOREM =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."

// 1. Basic (bottom)
export function BasicBottomVariant() {
  const [goal, setGoal] = React.useState(350)
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>Open Drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Move Goal</DrawerTitle>
          <DrawerDescription>Set your daily activity goal.</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col items-center gap-4 px-4 pb-2">
          <div className="flex items-center gap-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setGoal((g) => Math.max(0, g - 10))}
              aria-label="Decrease goal"
            >
              <MinusIcon className="size-4" />
            </Button>
            <span className="text-5xl font-bold tabular-nums w-24 text-center">
              {goal}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setGoal((g) => g + 10)}
              aria-label="Increase goal"
            >
              <PlusIcon className="size-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">calories/day</p>
        </div>
        <DrawerFooter>
          <Button>Submit</Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

// 2. Top
export function TopVariant() {
  return (
    <Drawer direction="top">
      <DrawerTrigger asChild>
        <Button variant="outline">Open Top</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>New notification</DrawerTitle>
          <DrawerDescription>
            You have a new message from the team. Check your inbox for details.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

// 3. Scrollable
export function ScrollableVariant() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Open</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Long content</DrawerTitle>
          <DrawerDescription>
            Scroll through the content below.
          </DrawerDescription>
        </DrawerHeader>
        <div className="max-h-[50vh] overflow-y-auto px-4 py-2 flex flex-col gap-3 text-sm text-muted-foreground">
          {Array.from({ length: 10 }, (_, i) => (
            <p key={i}>{LOREM}</p>
          ))}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

// 4. Cookie settings
export function CookieSettingsVariant() {
  const [analytics, setAnalytics] = React.useState(false)
  const [marketing, setMarketing] = React.useState(false)
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">
          <CookieIcon className="size-4 mr-2" />
          Cookie Settings
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Cookie Preferences</DrawerTitle>
          <DrawerDescription>
            Manage your cookie settings. You can choose which cookies to accept.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">Strictly necessary</p>
              <p className="text-xs text-muted-foreground">
                Required for the website to function.
              </p>
            </div>
            <Switch checked disabled aria-label="Strictly necessary cookies" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">Analytics</p>
              <p className="text-xs text-muted-foreground">
                Help us understand how you use our site.
              </p>
            </div>
            <Switch
              checked={analytics}
              onCheckedChange={setAnalytics}
              aria-label="Analytics cookies"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">Marketing</p>
              <p className="text-xs text-muted-foreground">
                Used to show you relevant ads.
              </p>
            </div>
            <Switch
              checked={marketing}
              onCheckedChange={setMarketing}
              aria-label="Marketing cookies"
            />
          </div>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Reject</Button>
          </DrawerClose>
          <DrawerClose asChild>
            <Button>Accept All</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

// 5. Login
export function LoginVariant() {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>Sign in</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Sign in</DrawerTitle>
          <DrawerDescription>
            Enter your credentials to access your account.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="drawer-login-email">Email</Label>
            <Input
              id="drawer-login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="drawer-login-password">Password</Label>
            <Input
              id="drawer-login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <DrawerFooter>
          <Button className="w-full">Sign in</Button>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

// 6. Add Task
export function AddTaskVariant() {
  const [title, setTitle] = React.useState("")
  const [notes, setNotes] = React.useState("")
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">
          <PlusIcon className="size-4 mr-2" />
          Add Task
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add Task</DrawerTitle>
          <DrawerDescription>
            Fill in the details to create a new task.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="drawer-task-title">Title</Label>
            <Input
              id="drawer-task-title"
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="drawer-task-priority">Priority</Label>
            <Select>
              <SelectTrigger id="drawer-task-priority" className="w-full">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="drawer-task-notes">Notes</Label>
            <Textarea
              id="drawer-task-notes"
              placeholder="Optional notes..."
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DrawerFooter>
          <Button>Add task</Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
