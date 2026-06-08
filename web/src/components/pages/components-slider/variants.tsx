"use client"

import * as React from "react"

import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Volume2, VolumeX, Volume1, DollarSign } from "lucide-react"

// ─── 1. Basic ─────────────────────────────────────────────────────────────────
export function BasicVariant() {
  return (
    <div className="flex flex-col gap-3">
      <Label>Volume</Label>
      <Slider defaultValue={50} />
    </div>
  )
}

// ─── 2. With value label ──────────────────────────────────────────────────────
export function WithValueLabelVariant() {
  const [value, setValue] = React.useState(40)
  return (
    <div className="flex flex-col gap-3" data-testid="slider-value">
      <div className="flex items-center justify-between">
        <Label>Volume</Label>
        <span
          data-testid="slider-value-output"
          className="text-sm font-medium tabular-nums"
        >
          Volume: {value}
        </span>
      </div>
      <Slider
        value={value}
        onValueChange={(v) => setValue(v as number)}
      />
    </div>
  )
}

// ─── 3. Range ─────────────────────────────────────────────────────────────────
export function RangeVariant() {
  const [range, setRange] = React.useState<readonly number[]>([25, 75])
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label>Range</Label>
        <span className="text-sm font-medium tabular-nums">
          {range[0]} – {range[1]}
        </span>
      </div>
      <Slider
        value={range}
        onValueChange={(v) => setRange(v as readonly number[])}
      />
    </div>
  )
}

// ─── 4. Steps ─────────────────────────────────────────────────────────────────
export function StepsVariant() {
  return (
    <div className="flex flex-col gap-3">
      <Label>Step (10)</Label>
      <Slider defaultValue={50} step={10} />
    </div>
  )
}

// ─── 5. With marks ────────────────────────────────────────────────────────────
const MARKS = [0, 25, 50, 75, 100]

export function WithMarksVariant() {
  return (
    <div className="flex flex-col gap-3">
      <Label>With marks</Label>
      <Slider defaultValue={50} />
      <div className="flex justify-between px-1">
        {MARKS.map((m) => (
          <span key={m} className="text-xs text-muted-foreground">
            {m}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── 6. Vertical ──────────────────────────────────────────────────────────────
export function VerticalVariant() {
  return (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <Label>Level</Label>
        <div className="h-40">
          <Slider defaultValue={60} orientation="vertical" />
        </div>
      </div>
    </div>
  )
}

// ─── 7. Disabled ──────────────────────────────────────────────────────────────
export function DisabledVariant() {
  return (
    <div className="flex flex-col gap-3">
      <Label>Disabled</Label>
      <Slider defaultValue={30} disabled />
    </div>
  )
}

// ─── 8. Colored ───────────────────────────────────────────────────────────────
export function ColoredVariant() {
  return (
    <div className="flex flex-col gap-3">
      <Label>Custom color</Label>
      <Slider
        defaultValue={65}
        className="[&_[data-slot=slider-range]]:bg-emerald-500"
      />
    </div>
  )
}

// ─── 9. With input ────────────────────────────────────────────────────────────
export function WithInputVariant() {
  const [value, setValue] = React.useState(50)

  function handleSlider(v: number | readonly number[]) {
    setValue(v as number)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const parsed = parseInt(e.target.value, 10)
    if (!isNaN(parsed)) {
      setValue(Math.min(100, Math.max(0, parsed)))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="slider-input">Amount</Label>
        <Input
          id="slider-input"
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={handleInput}
          className="w-20 text-right"
        />
      </div>
      <Slider value={value} onValueChange={handleSlider} />
    </div>
  )
}

// ─── 10. Volume ───────────────────────────────────────────────────────────────
function VolumeIcon({ level }: { level: number }) {
  if (level === 0) return <VolumeX className="size-4 shrink-0" />
  if (level < 40) return <Volume1 className="size-4 shrink-0" />
  return <Volume2 className="size-4 shrink-0" />
}

export function VolumeVariant() {
  const [volume, setVolume] = React.useState(60)
  return (
    <div className="flex flex-col gap-3">
      <Label>Volume</Label>
      <div className="flex items-center gap-3">
        <VolumeIcon level={volume} />
        <Slider
          value={volume}
          onValueChange={(v) => setVolume(v as number)}
          className="flex-1"
        />
        <span className="w-8 text-right text-sm tabular-nums">{volume}%</span>
      </div>
    </div>
  )
}

// ─── 11. Price range ──────────────────────────────────────────────────────────
export function PriceRangeVariant() {
  const [range, setRange] = React.useState<readonly number[]>([5, 1240])
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-0.5">
          <DollarSign className="size-3.5" />
          Price range
        </Label>
        <span className="text-sm font-medium tabular-nums">
          ${range[0]} – ${range[1].toLocaleString()}
        </span>
      </div>
      <Slider
        value={range}
        min={0}
        max={1500}
        onValueChange={(v) => setRange(v as readonly number[])}
      />
    </div>
  )
}

// ─── 12. Sizes ────────────────────────────────────────────────────────────────
export function SizesVariant() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Small (thin track)</Label>
        <Slider
          defaultValue={40}
          className="[&_[data-slot=slider-track]]:h-0.5"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Default</Label>
        <Slider defaultValue={60} />
      </div>
    </div>
  )
}

// ─── 13. Data capacity ────────────────────────────────────────────────────────
export function DataCapacityVariant() {
  const [gb, setGb] = React.useState(12)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label>Storage</Label>
        <span className={cn("text-sm font-medium tabular-nums", gb >= 30 && "text-destructive")}>
          {gb} GB
        </span>
      </div>
      <Slider
        value={gb}
        min={5}
        max={35}
        onValueChange={(v) => setGb(v as number)}
      />
      <div className="flex justify-between">
        <span className="text-xs text-muted-foreground">5 GB</span>
        <span className="text-xs text-muted-foreground">35 GB</span>
      </div>
    </div>
  )
}
