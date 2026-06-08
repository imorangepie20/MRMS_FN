"use client"

import * as React from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// ─── 1. Basic ─────────────────────────────────────────────────────────────────
export function BasicVariant() {
  const [indetermState, setIndetermState] = React.useState(false)
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex flex-col items-center gap-1.5">
        <Checkbox checked={false} onCheckedChange={() => {}} />
        <span className="text-xs text-muted-foreground">Unchecked</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <Checkbox checked={true} onCheckedChange={() => {}} />
        <span className="text-xs text-muted-foreground">Checked</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <Checkbox
          checked={indetermState}
          indeterminate={!indetermState}
          onCheckedChange={(v) => setIndetermState(!!v)}
        />
        <span className="text-xs text-muted-foreground">Indeterminate</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <Checkbox checked={false} disabled />
        <span className="text-xs text-muted-foreground">Disabled</span>
      </div>
    </div>
  )
}

// ─── 2. With label ────────────────────────────────────────────────────────────
export function WithLabelVariant() {
  const [checked, setChecked] = React.useState(false)
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="accept-terms"
        checked={checked}
        onCheckedChange={(v) => setChecked(!!v)}
      />
      <Label htmlFor="accept-terms">Accept terms and conditions</Label>
    </div>
  )
}

// ─── 3. Label with sublabel ──────────────────────────────────────────────────
export function LabelWithSublabelVariant() {
  const [checked, setChecked] = React.useState(false)
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id="marketing-emails"
        checked={checked}
        onCheckedChange={(v) => setChecked(!!v)}
        className="mt-0.5"
      />
      <div className="flex flex-col gap-0.5">
        <Label htmlFor="marketing-emails">Marketing emails</Label>
        <p className="text-xs text-muted-foreground">
          Receive product updates and offers.
        </p>
      </div>
    </div>
  )
}

// ─── 4. Colored ───────────────────────────────────────────────────────────────
export function ColoredVariant() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={true}
          onCheckedChange={() => {}}
          className="data-checked:border-emerald-600 data-checked:bg-emerald-600"
        />
        <Label>Emerald</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={true}
          onCheckedChange={() => {}}
          className="data-checked:border-blue-600 data-checked:bg-blue-600"
        />
        <Label>Blue</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={true}
          onCheckedChange={() => {}}
          className="data-checked:border-rose-600 data-checked:bg-rose-600"
        />
        <Label>Rose</Label>
      </div>
    </div>
  )
}

// ─── 5. Sizes ─────────────────────────────────────────────────────────────────
export function SizesVariant() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center gap-1.5">
        <Checkbox checked={true} onCheckedChange={() => {}} className="size-3" />
        <span className="text-xs text-muted-foreground">Small</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <Checkbox checked={true} onCheckedChange={() => {}} />
        <span className="text-xs text-muted-foreground">Default</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <Checkbox checked={true} onCheckedChange={() => {}} className="size-6 rounded-md [&>span>svg]:size-4" />
        <span className="text-xs text-muted-foreground">Large</span>
      </div>
    </div>
  )
}

// ─── 6. Selectable card ───────────────────────────────────────────────────────
const SELECTABLE_ITEMS = [
  { id: "plan-starter", label: "Starter", description: "Great for individuals." },
  { id: "plan-pro", label: "Pro", description: "For growing teams." },
  { id: "plan-enterprise", label: "Enterprise", description: "For large orgs." },
]

export function SelectableCardVariant() {
  const [selected, setSelected] = React.useState<Set<string>>(new Set(["plan-pro"]))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {SELECTABLE_ITEMS.map(({ id, label, description }) => {
        const isSelected = selected.has(id)
        return (
          <Card
            key={id}
            role="button"
            tabIndex={0}
            onClick={() => toggle(id)}
            onKeyDown={(e) => (e.key === " " || e.key === "Enter") && toggle(id)}
            className={cn(
              "flex cursor-pointer flex-row items-center gap-3 p-3 transition-colors",
              isSelected
                ? "border-primary bg-primary/5"
                : "hover:border-muted-foreground/30"
            )}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggle(id)}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ─── 7. Simple todo ───────────────────────────────────────────────────────────
const SIMPLE_TODOS = [
  { id: "todo-1", label: "Review pull request #142" },
  { id: "todo-2", label: "Update project documentation" },
  { id: "todo-3", label: "Set up staging environment" },
]

export function SimpleTodoVariant() {
  const [done, setDone] = React.useState<Set<string>>(new Set())

  function toggle(id: string) {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {SIMPLE_TODOS.map(({ id, label }) => {
        const isDone = done.has(id)
        return (
          <div key={id} className="flex items-center gap-3">
            <Checkbox
              id={id}
              checked={isDone}
              onCheckedChange={() => toggle(id)}
            />
            <Label
              htmlFor={id}
              className={cn(
                "cursor-pointer transition-colors",
                isDone && "text-muted-foreground line-through"
              )}
            >
              {label}
            </Label>
          </div>
        )
      })}
    </div>
  )
}

// ─── 8. Fancy todo ────────────────────────────────────────────────────────────
const FANCY_TODOS = [
  { id: "fancy-1", label: "Design new onboarding flow", priority: "High", color: "bg-red-500/15 text-red-600 dark:text-red-400" },
  { id: "fancy-2", label: "Integrate payment gateway", priority: "Medium", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { id: "fancy-3", label: "Write unit tests", priority: "Low", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
]

export function FancyTodoVariant() {
  const [done, setDone] = React.useState<Set<string>>(new Set())

  function toggle(id: string) {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {FANCY_TODOS.map(({ id, label, priority, color }) => {
        const isDone = done.has(id)
        return (
          <div key={id} className="flex items-center gap-3">
            <Checkbox
              id={`ftodo-${id}`}
              checked={isDone}
              onCheckedChange={() => toggle(id)}
            />
            <Label
              htmlFor={`ftodo-${id}`}
              className={cn(
                "flex-1 cursor-pointer transition-colors",
                isDone && "text-muted-foreground line-through"
              )}
            >
              {label}
            </Label>
            <Badge variant="secondary" className={color}>
              {priority}
            </Badge>
          </div>
        )
      })}
    </div>
  )
}

// ─── 9. Select all (permissions) ─────────────────────────────────────────────
const PERM_ITEMS = [
  { id: "perm-read", label: "Read" },
  { id: "perm-write", label: "Write" },
  { id: "perm-delete", label: "Delete" },
]

export function SelectAllPermsVariant() {
  const [checked, setChecked] = React.useState<Record<string, boolean>>({
    "perm-read": false,
    "perm-write": false,
    "perm-delete": false,
  })

  const allChecked = PERM_ITEMS.every((p) => checked[p.id])
  const someChecked = PERM_ITEMS.some((p) => checked[p.id])
  const isIndeterminate = someChecked && !allChecked

  function handleParent(v: boolean) {
    const next: Record<string, boolean> = {}
    PERM_ITEMS.forEach((p) => { next[p.id] = v })
    setChecked(next)
  }

  function handleChild(id: string, v: boolean) {
    setChecked((prev) => ({ ...prev, [id]: v }))
  }

  return (
    <div className="flex flex-col gap-3" data-testid="select-all-perms">
      <div className="flex items-center gap-2">
        <Checkbox
          id="perm-select-all"
          checked={allChecked}
          indeterminate={isIndeterminate}
          onCheckedChange={(v) => handleParent(!!v)}
        />
        <Label htmlFor="perm-select-all" className="font-semibold">
          Select all
        </Label>
      </div>
      <div className="flex flex-col gap-2 pl-6 border-l">
        {PERM_ITEMS.map(({ id, label }) => (
          <div key={id} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={checked[id]}
              onCheckedChange={(v) => handleChild(id, !!v)}
              aria-label={label}
            />
            <Label htmlFor={id}>{label}</Label>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 10. Hierarchical group ───────────────────────────────────────────────────
const PLATFORM_ITEMS = [
  { id: "plat-mobile", label: "Mobile App" },
  { id: "plat-desktop", label: "Desktop App" },
  { id: "plat-cloud", label: "Cloud Service" },
]

export function HierarchicalGroupVariant() {
  const [checked, setChecked] = React.useState<Record<string, boolean>>({
    "plat-mobile": true,
    "plat-desktop": false,
    "plat-cloud": true,
  })

  const allChecked = PLATFORM_ITEMS.every((p) => checked[p.id])
  const someChecked = PLATFORM_ITEMS.some((p) => checked[p.id])
  const isIndeterminate = someChecked && !allChecked

  function handleParent(v: boolean) {
    const next: Record<string, boolean> = {}
    PLATFORM_ITEMS.forEach((p) => { next[p.id] = v })
    setChecked(next)
  }

  function handleChild(id: string, v: boolean) {
    setChecked((prev) => ({ ...prev, [id]: v }))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id="plat-all"
          checked={allChecked}
          indeterminate={isIndeterminate}
          onCheckedChange={(v) => handleParent(!!v)}
        />
        <Label htmlFor="plat-all" className="font-semibold">
          All platforms
        </Label>
      </div>
      <div className="flex flex-col gap-2 pl-6 border-l">
        {PLATFORM_ITEMS.map(({ id, label }) => (
          <div key={id} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={checked[id]}
              onCheckedChange={(v) => handleChild(id, !!v)}
            />
            <Label htmlFor={id}>{label}</Label>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 11. Settings list ────────────────────────────────────────────────────────
const SETTINGS_ITEMS = [
  { id: "notif-email", label: "Email notifications", description: "Receive updates via email." },
  { id: "notif-push", label: "Push notifications", description: "Get alerts on your device." },
  { id: "notif-sms", label: "SMS notifications", description: "Text messages for critical alerts." },
]

export function SettingsListVariant() {
  const [enabled, setEnabled] = React.useState<Record<string, boolean>>({
    "notif-email": true,
    "notif-push": false,
    "notif-sms": false,
  })

  function toggle(id: string) {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="flex flex-col divide-y">
      {SETTINGS_ITEMS.map(({ id, label, description }) => (
        <div key={id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={id}>{label}</Label>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Checkbox
            id={id}
            checked={enabled[id]}
            onCheckedChange={() => toggle(id)}
          />
        </div>
      ))}
    </div>
  )
}

// ─── 12. With expansion ───────────────────────────────────────────────────────
export function WithExpansionVariant() {
  const [advanced, setAdvanced] = React.useState(false)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="enable-advanced"
          checked={advanced}
          onCheckedChange={(v) => setAdvanced(!!v)}
        />
        <Label htmlFor="enable-advanced">Enable advanced options</Label>
      </div>
      {advanced && (
        <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
          <p className="font-medium">Advanced options</p>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p>— Custom retry logic enabled</p>
            <p>— Extended logging activated</p>
            <p>— Beta feature flags unlocked</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 13. Disabled states ──────────────────────────────────────────────────────
export function DisabledStatesVariant() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id="disabled-unchecked" checked={false} disabled />
        <Label htmlFor="disabled-unchecked" className="opacity-50">
          Disabled unchecked
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="disabled-checked" checked={true} disabled />
        <Label htmlFor="disabled-checked" className="opacity-50">
          Disabled checked
        </Label>
      </div>
    </div>
  )
}
