"use client"

import * as React from "react"
import Link from "next/link"
import {
  InfoIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"

import { Alert, AlertTitle, AlertDescription, AlertAction } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ─── 1. Default ───────────────────────────────────────────────────────────────
export function DefaultVariant() {
  return (
    <Alert>
      <InfoIcon />
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>
        This is an alert with icon, title and description.
      </AlertDescription>
    </Alert>
  )
}

// ─── 2. Destructive ──────────────────────────────────────────────────────────
export function DestructiveVariant() {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>Unable to process your payment</AlertTitle>
      <AlertDescription>
        Your card was declined. Please try a different payment method.
      </AlertDescription>
    </Alert>
  )
}

// ─── 3. Success ──────────────────────────────────────────────────────────────
export function SuccessVariant() {
  return (
    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100 *:[svg]:text-emerald-600 dark:*:[svg]:text-emerald-400">
      <CircleCheckIcon />
      <AlertTitle>Payment successful</AlertTitle>
      <AlertDescription className="text-emerald-700 dark:text-emerald-300">
        Your payment has been processed.
      </AlertDescription>
    </Alert>
  )
}

// ─── 4. Warning ──────────────────────────────────────────────────────────────
export function WarningVariant() {
  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 *:[svg]:text-amber-600 dark:*:[svg]:text-amber-400">
      <TriangleAlertIcon />
      <AlertTitle>You are about to exceed your data limit</AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        Consider upgrading your plan.
      </AlertDescription>
    </Alert>
  )
}

// ─── 5. Info ─────────────────────────────────────────────────────────────────
export function InfoVariant() {
  return (
    <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100 *:[svg]:text-blue-600 dark:*:[svg]:text-blue-400">
      <InfoIcon />
      <AlertTitle>A friend request has been sent</AlertTitle>
      <AlertDescription className="text-blue-700 dark:text-blue-300">
        We&apos;ll notify you when they respond.
      </AlertDescription>
    </Alert>
  )
}

// ─── 6. Destructive (filled) ──────────────────────────────────────────────────
export function DestructiveFilledVariant() {
  return (
    <Alert className="border-transparent bg-destructive text-white *:[svg]:text-white *:data-[slot=alert-description]:text-white/85">
      <CircleAlertIcon />
      <AlertTitle>Unable to process your payment</AlertTitle>
      <AlertDescription>
        Your card was declined. Please try a different payment method.
      </AlertDescription>
    </Alert>
  )
}

// ─── 7. Success (filled) ──────────────────────────────────────────────────────
export function SuccessFilledVariant() {
  return (
    <Alert className="border-transparent bg-emerald-600 text-white *:[svg]:text-white *:data-[slot=alert-description]:text-white/85">
      <CircleCheckIcon />
      <AlertTitle>Payment successful</AlertTitle>
      <AlertDescription>
        Your payment has been processed successfully.
      </AlertDescription>
    </Alert>
  )
}

// ─── 8. Warning (filled) ──────────────────────────────────────────────────────
export function WarningFilledVariant() {
  return (
    <Alert className="border-transparent bg-amber-500 text-white *:[svg]:text-white *:data-[slot=alert-description]:text-white/85">
      <TriangleAlertIcon />
      <AlertTitle>Approaching data limit</AlertTitle>
      <AlertDescription>
        You&apos;ve used 90% of your monthly quota. Consider upgrading your plan.
      </AlertDescription>
    </Alert>
  )
}

// ─── 9. Info (left accent) ────────────────────────────────────────────────────
export function InfoLeftAccentVariant() {
  return (
    <Alert className="rounded-lg border border-blue-200 border-l-4 border-l-blue-500 bg-blue-50 text-blue-900 dark:border-blue-800 dark:border-l-blue-400 dark:bg-blue-950 dark:text-blue-100 *:[svg]:text-blue-600 dark:*:[svg]:text-blue-400">
      <InfoIcon />
      <AlertTitle>A friend request has been sent</AlertTitle>
      <AlertDescription className="text-blue-700 dark:text-blue-300">
        We&apos;ll notify you when they respond.
      </AlertDescription>
    </Alert>
  )
}

// ─── 10. Validation error ─────────────────────────────────────────────────────
export function ValidationErrorVariant() {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>Password does not meet requirements</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 list-none space-y-0.5">
          <li>• At least 8 characters</li>
          <li>• One uppercase letter</li>
          <li>• One number</li>
        </ul>
      </AlertDescription>
    </Alert>
  )
}

// ─── 11. With action ──────────────────────────────────────────────────────────
export function WithActionVariant() {
  return (
    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100 *:[svg]:text-emerald-600 dark:*:[svg]:text-emerald-400">
      <CircleCheckIcon />
      <AlertTitle>All the files have been moved</AlertTitle>
      <AlertDescription className="text-emerald-700 dark:text-emerald-300">
        Your files were transferred to the destination folder.
      </AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm">
          Undo
        </Button>
      </AlertAction>
    </Alert>
  )
}

// ─── 12. Dismissible ─────────────────────────────────────────────────────────
export function DismissibleVariant() {
  const [visible, setVisible] = React.useState(true)

  if (!visible) {
    return (
      <p className="text-sm text-muted-foreground italic">Alert dismissed.</p>
    )
  }

  return (
    <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100 *:[svg]:text-blue-600 dark:*:[svg]:text-blue-400">
      <InfoIcon />
      <AlertTitle>New features available</AlertTitle>
      <AlertDescription className="text-blue-700 dark:text-blue-300">
        Check out what&apos;s new in the latest release.
      </AlertDescription>
      <AlertAction>
        <button
          aria-label="Dismiss"
          onClick={() => setVisible(false)}
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-md text-blue-600 transition-colors",
            "hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          )}
        >
          <XIcon className="size-3.5" />
        </button>
      </AlertAction>
    </Alert>
  )
}

// ─── 13. With link ────────────────────────────────────────────────────────────
export function WithLinkVariant() {
  return (
    <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100 *:[svg]:text-blue-600 dark:*:[svg]:text-blue-400">
      <InfoIcon />
      <AlertTitle>Your account storage is almost full</AlertTitle>
      <AlertDescription className="text-blue-700 dark:text-blue-300">
        You&apos;re using 95% of your available storage.{" "}
        <Link
          href="#"
          className={buttonVariants({ variant: "link", size: "sm" })}
        >
          Upgrade now →
        </Link>
      </AlertDescription>
    </Alert>
  )
}

// ─── 14. Simple (no title) ────────────────────────────────────────────────────
export function SimpleNoTitleVariant() {
  return (
    <Alert>
      <InfoIcon />
      <AlertDescription>
        Your session will expire in 5 minutes. Save your work.
      </AlertDescription>
    </Alert>
  )
}

// ─── 15. Outline ──────────────────────────────────────────────────────────────
export function OutlineVariant() {
  return (
    <Alert className="border-border bg-transparent">
      <InfoIcon />
      <AlertTitle>Quick reminder</AlertTitle>
      <AlertDescription>
        Your next scheduled maintenance window starts tonight at 11 PM UTC.
      </AlertDescription>
    </Alert>
  )
}
