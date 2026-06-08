"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
  PopoverDescription,
  PopoverHeader,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// ─── 1. Dimensions ────────────────────────────────────────────────────────────
export function DimensionsVariant() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline">Open popover</Button>} />
      <PopoverContent className="w-80">
        <PopoverHeader>
          <PopoverTitle>Dimensions</PopoverTitle>
          <PopoverDescription>
            Set the dimensions for the layer.
          </PopoverDescription>
        </PopoverHeader>
        <div className="grid grid-cols-[1fr_2fr] items-center gap-x-3 gap-y-2">
          <Label htmlFor="dim-width" className="text-right text-xs">
            Width
          </Label>
          <Input id="dim-width" defaultValue="100%" className="h-7 text-xs" />

          <Label htmlFor="dim-max-width" className="text-right text-xs">
            Max. width
          </Label>
          <Input
            id="dim-max-width"
            defaultValue="300px"
            className="h-7 text-xs"
          />

          <Label htmlFor="dim-height" className="text-right text-xs">
            Height
          </Label>
          <Input id="dim-height" defaultValue="25px" className="h-7 text-xs" />

          <Label htmlFor="dim-max-height" className="text-right text-xs">
            Max. height
          </Label>
          <Input
            id="dim-max-height"
            defaultValue="none"
            className="h-7 text-xs"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── 2. With content ──────────────────────────────────────────────────────────
export function WithContentVariant() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline">Show info</Button>} />
      <PopoverContent className="w-72">
        <PopoverHeader>
          <PopoverTitle>What is a popover?</PopoverTitle>
          <PopoverDescription>
            A popover is a transient overlay that appears near its trigger
            element, used to display supplementary content without navigating
            away.
          </PopoverDescription>
        </PopoverHeader>
        <a
          href="#"
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Learn more →
        </a>
      </PopoverContent>
    </Popover>
  )
}

// ─── 3. Positioning ───────────────────────────────────────────────────────────
const SIDES = [
  { label: "Top", side: "top" },
  { label: "Right", side: "right" },
  { label: "Bottom", side: "bottom" },
  { label: "Left", side: "left" },
] as const

export function PositioningVariant() {
  return (
    <div className="flex flex-wrap gap-2">
      {SIDES.map(({ label, side }) => (
        <Popover key={side}>
          <PopoverTrigger render={<Button variant="outline">{label}</Button>} />
          <PopoverContent side={side} className="w-40 text-center text-xs">
            Anchored on the <strong>{label.toLowerCase()}</strong>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  )
}

// ─── 4. With form ─────────────────────────────────────────────────────────────
export function WithFormVariant() {
  const [open, setOpen] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [note, setNote] = React.useState("")

  function handleSave() {
    setOpen(false)
    setTitle("")
    setNote("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline">Add note</Button>} />
      <PopoverContent className="w-72">
        <PopoverHeader>
          <PopoverTitle>New note</PopoverTitle>
          <PopoverDescription>
            Fill in the fields below and save.
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="note-title" className="text-xs">
              Title
            </Label>
            <Input
              id="note-title"
              placeholder="Note title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="note-body" className="text-xs">
              Note
            </Label>
            <Input
              id="note-body"
              placeholder="Short note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <Button size="sm" onClick={handleSave} className="mt-1 self-end">
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── 5. Profile ───────────────────────────────────────────────────────────────
export function ProfileVariant() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" className="gap-2 px-2">
            <Avatar className="size-6">
              <AvatarFallback className="text-xs">SL</AvatarFallback>
            </Avatar>
            <span className="text-sm">@sarahlane</span>
          </Button>
        }
      />
      <PopoverContent className="w-64">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback>SL</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <p className="text-sm font-semibold">Sarah Lane</p>
              <p className="text-xs text-muted-foreground">@sarahlane</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Product designer building tools for creative teams. Open source
            enthusiast.
          </p>
          <Button size="sm" className="w-full">
            Follow
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── 6. Onboarding steps ──────────────────────────────────────────────────────
export function OnboardingStepsVariant() {
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState(1)
  const TOTAL = 3

  const steps = [
    {
      title: "Welcome to the dashboard",
      description:
        "Get a quick overview of all your key metrics and recent activity in one place.",
    },
    {
      title: "Customize your workspace",
      description:
        "Drag widgets to rearrange your layout and pin the views that matter most to you.",
    },
    {
      title: "Invite your team",
      description:
        "Collaboration is better together — invite teammates and assign roles in seconds.",
    },
  ]

  function handleSkip() {
    setOpen(false)
    setStep(1)
  }

  function handleNext() {
    if (step < TOTAL) {
      setStep((s) => s + 1)
    } else {
      setOpen(false)
      setStep(1)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="outline">Start tour</Button>}
      />
      <PopoverContent className="w-72">
        <div className="flex flex-col gap-3">
          <Badge variant="secondary" className={cn("w-fit text-xs")}>
            Step {step} of {TOTAL}
          </Badge>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">{steps[step - 1].title}</p>
            <p className="text-xs text-muted-foreground">
              {steps[step - 1].description}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={handleSkip}
            >
              Skip
            </Button>
            <Button size="sm" className="h-7 gap-1 px-3 text-xs" onClick={handleNext}>
              {step < TOTAL ? "Next" : "Finish"}
              <ChevronRight className="size-3" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
