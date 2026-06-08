"use client"

import * as React from "react"

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  Settings,
  HelpCircle,
} from "lucide-react"

// ─── 1. Basic toggle ─────────────────────────────────────────────────────────
export function BasicToggleVariant() {
  const [open, setOpen] = React.useState(false)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="w-full space-y-2"
      data-testid="collapsible-basic"
    >
      <div className="flex items-center justify-between space-x-4">
        <h4 className="text-sm font-semibold">
          @peduarte starred 3 repositories
        </h4>
        <CollapsibleTrigger
          aria-label="Toggle repositories"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "size-9 p-0"
          )}
        >
          <ChevronsUpDown className="size-4" />
          <span className="sr-only">Toggle</span>
        </CollapsibleTrigger>
      </div>

      <div className="rounded-md border px-4 py-2 font-mono text-sm shadow-sm">
        @radix-ui/primitives
      </div>

      <CollapsibleContent className="space-y-2">
        <div className="rounded-md border px-4 py-2 font-mono text-sm shadow-sm">
          @radix-ui/colors
        </div>
        <div className="rounded-md border px-4 py-2 font-mono text-sm shadow-sm">
          @stitches/react
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── 2. With chevron ─────────────────────────────────────────────────────────
export function WithChevronVariant() {
  const [open, setOpen] = React.useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
        Is it accessible?
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t px-4 py-3 text-sm text-muted-foreground">
          Yes. It adheres to the WAI-ARIA design pattern.
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── 3. Show more / less ─────────────────────────────────────────────────────
export function ShowMoreVariant() {
  const [open, setOpen] = React.useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full space-y-2">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Base UI is an open-source library of headless UI components for React.
        It provides a solid foundation you can build on, giving you full control
        over your component&apos;s styles and structure.
      </p>
      <CollapsibleContent>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Base UI components are unstyled and fully accessible out of the box.
          They include all the behavior, accessibility features, and ARIA
          attributes you need without any default look and feel. This means
          you&apos;re free to style them however you like.
        </p>
      </CollapsibleContent>
      <CollapsibleTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 text-xs px-2")}>
        {open ? "Show less" : "Show more"}
      </CollapsibleTrigger>
    </Collapsible>
  )
}

// ─── 4. With card ────────────────────────────────────────────────────────────
export function WithCardVariant() {
  const [open, setOpen] = React.useState(false)

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Notifications</CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage your notification preferences.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span>Email notifications</span>
          <span className="text-muted-foreground">Enabled</span>
        </div>
        <Separator />
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-foreground text-muted-foreground transition-colors">
            Advanced settings
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Digest frequency</span>
              <span>Daily</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sound alerts</span>
              <span>Off</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Marketing emails</span>
              <span>Off</span>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}

// ─── 5. With form / comments ─────────────────────────────────────────────────
export function WithCommentsVariant() {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="w-full space-y-3">
      {/* Main comment */}
      <div className="flex gap-3">
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">JD</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">John Doe</span>
            <span className="text-xs text-muted-foreground">2h ago</span>
          </div>
          <p className="text-sm text-muted-foreground">
            This is a great component library! Highly recommend it.
          </p>
        </div>
      </div>

      {/* Replies collapsible */}
      <Collapsible open={open} onOpenChange={setOpen} className="pl-11">
        <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <ChevronRight
            className={cn(
              "size-3 transition-transform duration-200",
              open && "rotate-90"
            )}
          />
          {open ? "Hide replies" : "2 replies"}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          <div className="flex gap-3">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">AS</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">Alice Smith</span>
                <span className="text-xs text-muted-foreground">1h ago</span>
              </div>
              <p className="text-sm text-muted-foreground">Totally agree!</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">BJ</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">Bob Jones</span>
                <span className="text-xs text-muted-foreground">30m ago</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Using it in production already.
              </p>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">Me</AvatarFallback>
            </Avatar>
            <Input
              placeholder="Write a reply…"
              className="h-7 text-xs"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// ─── 6. FAQ item ─────────────────────────────────────────────────────────────
export function FaqItemVariant() {
  const [open, setOpen] = React.useState(false)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="w-full rounded-md border"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors text-left">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-4 text-muted-foreground shrink-0" />
          What is your refund policy?
        </div>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200 shrink-0",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t px-4 py-3 text-sm text-muted-foreground">
          We offer a 30-day money-back guarantee on all plans. If you&apos;re not
          satisfied, contact our support team within 30 days of purchase for a
          full refund, no questions asked.
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── 7. Nested ───────────────────────────────────────────────────────────────
export function NestedVariant() {
  const [projectOpen, setProjectOpen] = React.useState(false)
  const [srcOpen, setSrcOpen] = React.useState(false)

  return (
    <div className="w-full rounded-md border">
      <Collapsible open={projectOpen} onOpenChange={setProjectOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
          <ChevronRight
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              projectOpen && "rotate-90"
            )}
          />
          Project
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pl-6 border-t">
            <Collapsible open={srcOpen} onOpenChange={setSrcOpen}>
              <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
                <ChevronRight
                  className={cn(
                    "size-4 text-muted-foreground transition-transform duration-200",
                    srcOpen && "rotate-90"
                  )}
                />
                src
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="pl-6 border-t space-y-0">
                  {["index.ts", "app.tsx", "utils.ts"].map((file) => (
                    <div
                      key={file}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                    >
                      <span className="size-4" />
                      {file}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// ─── 8. Sidebar group ────────────────────────────────────────────────────────
export function SidebarGroupVariant() {
  const [open, setOpen] = React.useState(false)

  const subItems = [
    { label: "Profile" },
    { label: "Account" },
    { label: "Appearance" },
  ]

  return (
    <div className="w-full rounded-md border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">
          <Settings className="size-4 text-muted-foreground shrink-0" />
          <span className="flex-1 text-left">Settings</span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t py-1">
            {subItems.map(({ label }) => (
              <div
                key={label}
                className="flex items-center gap-2 py-1.5 pl-10 pr-3 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer"
              >
                {label}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
