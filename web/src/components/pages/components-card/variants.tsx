"use client"

import * as React from "react"
import { Inbox, UserPlus, ArrowRight } from "lucide-react"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

// ─── 1. Standard ──────────────────────────────────────────────────────────────
export function StandardVariant() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This is some content inside the card body area.
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm">Cancel</Button>
        <Button size="sm">Save</Button>
      </CardFooter>
    </Card>
  )
}

// ─── 2. Login / Form ──────────────────────────────────────────────────────────
export function LoginFormVariant() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>Enter your credentials to sign in.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="card-email">Email</Label>
          <Input id="card-email" type="email" placeholder="m@example.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="card-password">Password</Label>
            <a
              href="#"
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </a>
          </div>
          <Input id="card-password" type="password" placeholder="••••••••" />
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button className="w-full">Sign in</Button>
        <Button variant="outline" className="w-full">
          Or continue with Google
        </Button>
      </CardFooter>
    </Card>
  )
}

// ─── 3. Blog / Image ─────────────────────────────────────────────────────────
export function BlogImageVariant() {
  return (
    <Card className="overflow-hidden">
      <div className="h-40 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500" />
      <CardHeader>
        <CardTitle>How to Create Stunning Gradients for Your Website</CardTitle>
        <CardDescription>
          Learn the techniques behind eye-catching color transitions that
          captivate your visitors.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <a
          href="#"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Read more <ArrowRight className="size-3.5" />
        </a>
      </CardFooter>
    </Card>
  )
}

// ─── 4. Help / Action ────────────────────────────────────────────────────────
export function HelpActionVariant() {
  const steps = [
    "Describe your issue in detail.",
    "Attach any relevant screenshots.",
    "Submit and we'll respond within 24 h.",
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Need help with a claim?</CardTitle>
        <CardDescription>
          Follow these steps to get support as quickly as possible.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <p className="text-sm leading-snug text-muted-foreground">{step}</p>
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button size="sm">Contact support</Button>
      </CardFooter>
    </Card>
  )
}

// ─── 5. Tabbed ────────────────────────────────────────────────────────────────
export function TabbedVariant() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
        <CardDescription>Your account at a glance.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4 flex flex-col gap-2">
            <div className="flex justify-between rounded-lg border p-3 text-sm">
              <span className="text-muted-foreground">Active users</span>
              <span className="font-semibold">1,248</span>
            </div>
            <div className="flex justify-between rounded-lg border p-3 text-sm">
              <span className="text-muted-foreground">Uptime</span>
              <span className="font-semibold">99.9%</span>
            </div>
          </TabsContent>
          <TabsContent value="analytics" className="mt-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">84,502</p>
              <p className="text-sm text-muted-foreground">
                Total page views this month
              </p>
            </div>
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span className="text-muted-foreground">Email notifications</span>
              <span className="font-medium text-primary">Enabled</span>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// ─── 6. Cookie consent ───────────────────────────────────────────────────────
export function CookieConsentVariant() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>We use cookies</CardTitle>
        <CardDescription>
          We use cookies to improve your experience, analyze traffic, and
          personalize content. You can manage your preferences at any time.
        </CardDescription>
      </CardHeader>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm">Reject</Button>
        <Button size="sm">Accept All</Button>
      </CardFooter>
    </Card>
  )
}

// ─── 7. Empty state ──────────────────────────────────────────────────────────
export function EmptyStateVariant() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
        <CardDescription>Manage your team and invite collaborators.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Inbox className="size-6 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">No members yet</p>
          <p className="text-xs text-muted-foreground">
            Invite people to collaborate on this project.
          </p>
        </div>
        <Button size="sm">
          <UserPlus className="size-4" />
          Invite
        </Button>
      </CardContent>
    </Card>
  )
}

// ─── 8. Stats / Metric ───────────────────────────────────────────────────────
export function StatsMetricVariant() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Revenue</CardTitle>
        <CardDescription>All-time revenue across all channels.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-3xl font-bold tracking-tight">$15,231.89</p>
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          +20.1% from last month
        </p>
      </CardContent>
    </Card>
  )
}
