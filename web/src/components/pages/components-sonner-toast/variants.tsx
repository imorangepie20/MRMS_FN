"use client"

import { toast } from "sonner"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"

// ─── 1. Default ───────────────────────────────────────────────────────────────
export function DefaultVariant() {
  return (
    <Button onClick={() => toast("Event has been created")}>
      Show Toast
    </Button>
  )
}

// ─── 2. Success ───────────────────────────────────────────────────────────────
export function SuccessVariant() {
  return (
    <Button onClick={() => toast.success("Your changes have been saved")}>
      Show Success
    </Button>
  )
}

// ─── 3. Error ─────────────────────────────────────────────────────────────────
export function ErrorVariant() {
  return (
    <Button
      variant="destructive"
      onClick={() => toast.error("Something went wrong. Please try again.")}
    >
      Show Error
    </Button>
  )
}

// ─── 4. Warning ───────────────────────────────────────────────────────────────
export function WarningVariant() {
  return (
    <Button
      variant="outline"
      onClick={() => toast.warning("This action cannot be undone")}
    >
      Show Warning
    </Button>
  )
}

// ─── 5. Info ──────────────────────────────────────────────────────────────────
export function InfoVariant() {
  return (
    <Button
      variant="outline"
      onClick={() => toast.info("A new software update is available")}
    >
      Show Info
    </Button>
  )
}

// ─── 6. With description ──────────────────────────────────────────────────────
export function WithDescriptionVariant() {
  return (
    <Button
      onClick={() =>
        toast("Event created", {
          description: "Monday, January 3rd at 6:00pm",
        })
      }
    >
      Show with Description
    </Button>
  )
}

// ─── 7. With action ───────────────────────────────────────────────────────────
export function WithActionVariant() {
  return (
    <Button
      onClick={() =>
        toast("Event created", {
          action: {
            label: "Undo",
            onClick: () => toast("Undone"),
          },
        })
      }
    >
      Show with Action
    </Button>
  )
}

// ─── 8. With cancel ───────────────────────────────────────────────────────────
export function WithCancelVariant() {
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast("Sending…", {
          cancel: {
            label: "Cancel",
            onClick: () => {},
          },
        })
      }
    >
      Show with Cancel
    </Button>
  )
}

// ─── 9. Promise ───────────────────────────────────────────────────────────────
export function PromiseVariant() {
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast.promise(new Promise((res) => setTimeout(res, 1500)), {
          loading: "Saving…",
          success: "Saved!",
          error: "Failed",
        })
      }
    >
      Show Promise
    </Button>
  )
}

// ─── 10. Loading ──────────────────────────────────────────────────────────────
export function LoadingVariant() {
  return (
    <Button
      variant="outline"
      onClick={() => toast.loading("Loading data…")}
    >
      Show Loading
    </Button>
  )
}

// ─── 11. Custom (JSX) ─────────────────────────────────────────────────────────
export function CustomJsxVariant() {
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast.custom((t) => (
          <div className="flex items-start gap-3 rounded-lg border bg-popover p-4 shadow-md">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Send className="size-4" />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-sm font-medium">Custom Toast</p>
              <p className="text-xs text-muted-foreground">
                This is a fully custom JSX toast notification.
              </p>
            </div>
            <button
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => toast.dismiss(t)}
            >
              Dismiss
            </button>
          </div>
        ))
      }
    >
      Show Custom
    </Button>
  )
}

// ─── 12. Rich / with icon ─────────────────────────────────────────────────────
export function RichWithIconVariant() {
  return (
    <Button
      onClick={() =>
        toast("Message sent", {
          icon: <Send className="size-4" />,
          description: "Your message was delivered successfully.",
        })
      }
    >
      Show with Icon
    </Button>
  )
}
