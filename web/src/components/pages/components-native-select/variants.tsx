"use client"

import * as React from "react"
import { AlertCircle } from "lucide-react"

import {
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
} from "@/components/ui/native-select"
import { Label } from "@/components/ui/label"

// ─── 1. Default ───────────────────────────────────────────────────────────────
export function DefaultVariant() {
  return (
    <NativeSelect aria-label="Status" className="w-full">
      <NativeSelectOption value="Todo">Todo</NativeSelectOption>
      <NativeSelectOption value="In Progress">In Progress</NativeSelectOption>
      <NativeSelectOption value="Done">Done</NativeSelectOption>
      <NativeSelectOption value="Cancelled">Cancelled</NativeSelectOption>
    </NativeSelect>
  )
}

// ─── 2. With label ────────────────────────────────────────────────────────────
export function WithLabelVariant() {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="framework-select">Framework</Label>
      <NativeSelect id="framework-select" className="w-full">
        <NativeSelectOption value="react">React</NativeSelectOption>
        <NativeSelectOption value="nextjs">Next.js</NativeSelectOption>
        <NativeSelectOption value="astro">Astro</NativeSelectOption>
        <NativeSelectOption value="gatsby">Gatsby</NativeSelectOption>
      </NativeSelect>
    </div>
  )
}

// ─── 3. With helper text ──────────────────────────────────────────────────────
export function WithHelperTextVariant() {
  return (
    <div className="flex flex-col gap-2">
      <NativeSelect className="w-full">
        <NativeSelectOption value="react">React</NativeSelectOption>
        <NativeSelectOption value="nextjs">Next.js</NativeSelectOption>
        <NativeSelectOption value="astro">Astro</NativeSelectOption>
        <NativeSelectOption value="gatsby">Gatsby</NativeSelectOption>
      </NativeSelect>
      <p className="text-sm text-muted-foreground">
        Tell us your favorite framework.
      </p>
    </div>
  )
}

// ─── 4. Error state ───────────────────────────────────────────────────────────
export function ErrorStateVariant() {
  return (
    <div className="flex flex-col gap-2">
      <NativeSelect aria-invalid className="w-full">
        <NativeSelectOption value="react">React</NativeSelectOption>
        <NativeSelectOption value="nextjs">Next.js</NativeSelectOption>
        <NativeSelectOption value="astro">Astro</NativeSelectOption>
        <NativeSelectOption value="gatsby">Gatsby</NativeSelectOption>
      </NativeSelect>
      <p className="flex items-center gap-1.5 text-sm text-destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
        Selected option is invalid.
      </p>
    </div>
  )
}

// ─── 5. Option groups ─────────────────────────────────────────────────────────
export function OptionGroupsVariant() {
  return (
    <NativeSelect className="w-full">
      <NativeSelectOptGroup label="Frontend">
        <NativeSelectOption value="react">React</NativeSelectOption>
        <NativeSelectOption value="vue">Vue</NativeSelectOption>
        <NativeSelectOption value="angular">Angular</NativeSelectOption>
      </NativeSelectOptGroup>
      <NativeSelectOptGroup label="Backend">
        <NativeSelectOption value="nodejs">Node.js</NativeSelectOption>
        <NativeSelectOption value="python">Python</NativeSelectOption>
        <NativeSelectOption value="java">Java</NativeSelectOption>
      </NativeSelectOptGroup>
    </NativeSelect>
  )
}
