"use client"

import * as React from "react"
import {
  Mail,
  Printer,
  Plus,
  Trash2,
  ChevronDown,
  Loader2,
  Download,
  ArrowRight,
  Settings,
  Bell,
  Apple,
  Heart,
  Check,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

// ─── 1. Default ───────────────────────────────────────────────────────────────
export function DefaultVariant() {
  return <Button>Button</Button>
}

// ─── 2. Secondary ─────────────────────────────────────────────────────────────
export function SecondaryVariant() {
  return <Button variant="secondary">Secondary</Button>
}

// ─── 3. Outline ───────────────────────────────────────────────────────────────
export function OutlineVariant() {
  return <Button variant="outline">Outline</Button>
}

// ─── 4. Ghost ─────────────────────────────────────────────────────────────────
export function GhostVariant() {
  return <Button variant="ghost">Ghost</Button>
}

// ─── 5. Link ──────────────────────────────────────────────────────────────────
export function LinkVariant() {
  return <Button variant="link">Link</Button>
}

// ─── 6. Destructive ───────────────────────────────────────────────────────────
export function DestructiveVariant() {
  return (
    <Button variant="destructive">
      <Trash2 />
      Delete
    </Button>
  )
}

// ─── 7. Sizes ─────────────────────────────────────────────────────────────────
export function SizesVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Print">
        <Printer />
      </Button>
    </div>
  )
}

// ─── 8. Leading icon ──────────────────────────────────────────────────────────
export function LeadingIconVariant() {
  return (
    <Button>
      <Mail />
      Login with Email
    </Button>
  )
}

// ─── 9. Trailing icon ─────────────────────────────────────────────────────────
export function TrailingIconVariant() {
  return (
    <Button>
      Continue
      <ArrowRight />
    </Button>
  )
}

// ─── 10. Icon only ────────────────────────────────────────────────────────────
export function IconOnlyVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button size="icon" variant="outline" aria-label="Settings">
        <Settings />
      </Button>
      <Button size="icon" variant="ghost" aria-label="Notifications">
        <Bell />
      </Button>
      <Button size="icon" aria-label="Add">
        <Plus />
      </Button>
    </div>
  )
}

// ─── 11. Loading ──────────────────────────────────────────────────────────────
export function LoadingVariant() {
  const [loading, setLoading] = React.useState(false)

  function handleClick() {
    setLoading(true)
    const timer = setTimeout(() => setLoading(false), 1500)
    return () => clearTimeout(timer)
  }

  return (
    <Button disabled={loading} onClick={handleClick}>
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          Please wait
        </>
      ) : (
        <>
          <Download />
          Download
        </>
      )}
    </Button>
  )
}

// ─── 12. Disabled ─────────────────────────────────────────────────────────────
export function DisabledVariant() {
  return <Button disabled>Disabled</Button>
}

// ─── 13. With badge / count ───────────────────────────────────────────────────
export function WithBadgeVariant() {
  return (
    <div className="relative inline-flex">
      <Button variant="outline">
        Messages
      </Button>
      <Badge className="absolute -top-2 -right-2 min-w-5 rounded-full px-1.5 tabular-nums">
        18
      </Badge>
    </div>
  )
}

// ─── 14. Full width ───────────────────────────────────────────────────────────
export function FullWidthVariant() {
  return <Button className="w-full">Full Width Button</Button>
}

// ─── 15. Rounded / pill ───────────────────────────────────────────────────────
export function RoundedVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button className="rounded-full">Pill Button</Button>
      <Button variant="outline" className="rounded-full">
        Outline Pill
      </Button>
    </div>
  )
}

// ─── 16. Gradient ─────────────────────────────────────────────────────────────
export function GradientVariant() {
  return (
    <Button className="bg-linear-to-r from-indigo-500 to-purple-500 text-white border-0 hover:opacity-90 hover:from-indigo-500 hover:to-purple-500">
      Gradient Button
    </Button>
  )
}

// ─── 17. Google ───────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="size-4 shrink-0"
    xmlns="http://www.w3.org/2000/svg"
  >
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
)

export function GoogleVariant() {
  return (
    <Button variant="outline">
      <GoogleIcon />
      Continue with Google
    </Button>
  )
}

// ─── 18. GitHub ───────────────────────────────────────────────────────────────
const GitHubIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="size-4 shrink-0"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
)

export function GitHubVariant() {
  return (
    <Button variant="outline">
      <GitHubIcon />
      Continue with GitHub
    </Button>
  )
}

// ─── 19. Apple ────────────────────────────────────────────────────────────────
export function AppleVariant() {
  return (
    <Button className="bg-black text-white hover:bg-black/80 border-0">
      <Apple />
      Continue with Apple
    </Button>
  )
}

// ─── 20. X (Twitter) ─────────────────────────────────────────────────────────
const XIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="size-4 shrink-0"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.261 5.638 5.903-5.638zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

export function XTwitterVariant() {
  return (
    <Button className="bg-black text-white hover:bg-black/80 border-0">
      <XIcon />
      Continue with X
    </Button>
  )
}

// ─── 21. Facebook ─────────────────────────────────────────────────────────────
const FacebookIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="size-4 shrink-0"
    fill="#1877F2"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
)

export function FacebookVariant() {
  return (
    <Button variant="outline">
      <FacebookIcon />
      Continue with Facebook
    </Button>
  )
}

// ─── 22. Button group ─────────────────────────────────────────────────────────
export function ButtonGroupVariant() {
  const [active, setActive] = React.useState<"day" | "week" | "month">("day")

  return (
    <div className="inline-flex rounded-lg shadow-xs" role="group">
      <button
        onClick={() => setActive("day")}
        className={cn(
          "h-8 rounded-l-lg rounded-r-none border px-3 text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:z-10",
          active === "day"
            ? "bg-primary text-primary-foreground border-primary z-10"
            : "bg-background text-foreground border-border hover:bg-muted -mr-px"
        )}
      >
        Day
      </button>
      <button
        onClick={() => setActive("week")}
        className={cn(
          "h-8 rounded-none border px-3 text-sm font-medium transition-colors -ml-px",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:z-10",
          active === "week"
            ? "bg-primary text-primary-foreground border-primary z-10"
            : "bg-background text-foreground border-border hover:bg-muted"
        )}
      >
        Week
      </button>
      <button
        onClick={() => setActive("month")}
        className={cn(
          "h-8 rounded-l-none rounded-r-lg border px-3 text-sm font-medium transition-colors -ml-px",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:z-10",
          active === "month"
            ? "bg-primary text-primary-foreground border-primary z-10"
            : "bg-background text-foreground border-border hover:bg-muted"
        )}
      >
        Month
      </button>
    </div>
  )
}

// ─── 23. With tooltip ─────────────────────────────────────────────────────────
export function WithTooltipVariant() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={<Button variant="outline" />}
        >
          <Heart className="mr-1.5 size-4" />
          Like
        </TooltipTrigger>
        <TooltipContent>Add to favorites</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─── 24. Destructive outline ──────────────────────────────────────────────────
export function DestructiveOutlineVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button
        variant="outline"
        className="border-destructive text-destructive hover:bg-destructive/10"
      >
        <Trash2 />
        Delete Account
      </Button>
    </div>
  )
}

// ─── 25. Soft / subtle ────────────────────────────────────────────────────────
export function SoftVariant() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button className="bg-primary/10 text-primary hover:bg-primary/20 border-0">
        Primary
      </Button>
      <Button className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0 dark:text-emerald-400">
        Success
      </Button>
      <Button className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-0 dark:text-amber-400">
        Warning
      </Button>
    </div>
  )
}

// ─── 26. Split button ─────────────────────────────────────────────────────────
export function SplitButtonVariant() {
  return (
    <div className="inline-flex rounded-lg shadow-xs">
      <Button className="rounded-r-none border-r-0">
        <Check />
        Save
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="More options"
              className="rounded-l-none border-l border-l-primary-foreground/20 px-2"
            />
          }
        >
          <ChevronDown className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Save</DropdownMenuItem>
          <DropdownMenuItem>Save as…</DropdownMenuItem>
          <DropdownMenuItem>Export</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ─── 27. Block CTA ────────────────────────────────────────────────────────────
export function BlockCTAVariant() {
  return (
    <Button className="w-full bg-linear-to-r from-violet-500 to-indigo-500 text-white border-0 hover:opacity-90 hover:from-violet-500 hover:to-indigo-500 h-11 text-base font-semibold rounded-xl gap-2">
      <ArrowRight className="size-5" />
      Get Started
    </Button>
  )
}
