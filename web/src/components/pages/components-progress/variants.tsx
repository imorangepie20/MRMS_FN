"use client"

import * as React from "react"
import { Cpu, HardDrive, MemoryStick, Upload, Check, Cloud } from "lucide-react"

import {
  Progress,
  ProgressLabel,
} from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

// ─── 1. Basic ─────────────────────────────────────────────────────────────────
export function BasicVariant() {
  return (
    <div className="w-full">
      <Progress value={60} />
    </div>
  )
}

// ─── 2. With label ────────────────────────────────────────────────────────────
export function WithLabelVariant() {
  return (
    <div className="w-full">
      <Progress value={75} className="flex-col gap-1.5">
        <div className="flex w-full items-center justify-between">
          <ProgressLabel>Uploading…</ProgressLabel>
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">
            75%
          </span>
        </div>
      </Progress>
    </div>
  )
}

// ─── 3. Colored ───────────────────────────────────────────────────────────────
const COLORED_BARS = [
  { label: "Success", percent: 80, color: "bg-emerald-500" },
  { label: "Warning", percent: 55, color: "bg-amber-500" },
  { label: "Error",   percent: 30, color: "bg-red-500" },
]

export function ColoredVariant() {
  return (
    <div className="flex w-full flex-col gap-4">
      {COLORED_BARS.map(({ label, percent, color }) => (
        <div key={label} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums">{percent}%</span>
          </div>
          {/* Plain track/indicator div — avoids requiring Progress.Root context */}
          <div className="relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${color}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 4. System metrics ────────────────────────────────────────────────────────
const METRICS = [
  { label: "CPU", icon: Cpu, value: 45 },
  { label: "Memory", icon: MemoryStick, value: 62 },
  { label: "Disk", icon: HardDrive, value: 38 },
]

export function SystemMetricsVariant() {
  return (
    <div className="flex w-full flex-col gap-4">
      {METRICS.map(({ label, icon: Icon, value }) => (
        <div key={label} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="size-3.5" />
              {label}
            </span>
            <span className="font-medium tabular-nums">{value}%</span>
          </div>
          <Progress value={value} />
        </div>
      ))}
    </div>
  )
}

// ─── 5. Setup steps ──────────────────────────────────────────────────────────
export function SetupStepsVariant() {
  const total = 4
  const completed = 2
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Step {completed} of {total}
      </p>
      <div className="flex w-full gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < completed ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

// ─── 6. Multi-item ───────────────────────────────────────────────────────────
const PROJECT_ITEMS = [
  { label: "Design Phase", value: 85 },
  { label: "Development", value: 60 },
  { label: "Testing", value: 30 },
]

export function MultiItemVariant() {
  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-sm font-medium">Project status</p>
      {PROJECT_ITEMS.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums">{value}%</span>
          </div>
          <Progress value={value} />
        </div>
      ))}
    </div>
  )
}

// ─── 7. Storage usage ────────────────────────────────────────────────────────
export function StorageUsageVariant() {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Storage</span>
        </div>
        <Badge variant="secondary">Medium</Badge>
      </div>
      <Progress value={75} />
      <p className="text-xs text-muted-foreground">7.5 GB of 10 GB used</p>
    </div>
  )
}

// ─── 8. Indeterminate ────────────────────────────────────────────────────────
export function IndeterminateVariant() {
  return (
    <div className="w-full">
      {/* Plain track div — no Progress.Root context needed for indeterminate */}
      <div
        role="progressbar"
        aria-label="Loading"
        className="relative flex h-1 w-full items-center overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
      <style>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  )
}

// ─── 9. Circular ─────────────────────────────────────────────────────────────
export function CircularVariant() {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const percent = 75
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="flex items-center justify-center">
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          strokeWidth="8"
          className="stroke-muted"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="stroke-primary transition-all"
          transform="rotate(-90 48 48)"
        />
        <text
          x="48"
          y="53"
          textAnchor="middle"
          className="fill-foreground text-sm font-semibold"
          fontSize="14"
          fontWeight="600"
        >
          {percent}%
        </text>
      </svg>
    </div>
  )
}

// ─── 10. Interactive upload ───────────────────────────────────────────────────
export function InteractiveUploadVariant() {
  const [progress, setProgress] = React.useState(0)
  const [running, setRunning] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const startUpload = () => {
    if (running || done) return
    setRunning(true)
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 20
        if (next >= 100) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          setRunning(false)
          setDone(true)
          return 100
        }
        return next
      })
    }, 300)
  }

  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setProgress(0)
    setRunning(false)
    setDone(false)
  }

  React.useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <div className="flex w-full flex-col gap-4" data-testid="progress-upload">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">File upload</p>
        {done && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" />
            Completed
          </span>
        )}
      </div>
      <Progress value={progress} className="flex-col gap-1.5">
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {progress}%
        </span>
      </Progress>
      <div className="flex gap-2">
        {!done ? (
          <Button
            size="sm"
            onClick={startUpload}
            disabled={running}
            className="gap-1.5"
          >
            <Upload className="size-3.5" />
            Upload
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={reset}>
            Reset
          </Button>
        )}
      </div>
    </div>
  )
}
