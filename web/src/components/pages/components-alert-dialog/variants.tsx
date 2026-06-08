"use client"

import * as React from "react"
import { CheckIcon, TriangleAlertIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const LOREM =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."

// 1. Confirm
export function ConfirmVariant() {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button>Show Dialog</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently affect your
            account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 2. Delete Item
export function DeleteItemVariant() {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive">Delete</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete item?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the item and remove it from our
            servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 3. Alert dialog with icon
export function WithIconVariant() {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline">Open</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-amber-100 dark:bg-amber-900/30">
            <TriangleAlertIcon className="size-5 text-amber-600 dark:text-amber-400" />
          </AlertDialogMedia>
          <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes that will be lost. Do you want to
            continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
          <AlertDialogAction>Leave</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 4. Scrollable (native scrollbar)
export function ScrollableNativeVariant() {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline">Open</Button>} />
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Terms of Service</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="max-h-72 overflow-y-auto pr-1 text-sm text-muted-foreground space-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <p key={i}>{LOREM}</p>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Decline</AlertDialogCancel>
          <AlertDialogAction>Accept</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 5. Scrollable (custom scrollbar)
export function ScrollableCustomVariant() {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline">Open</Button>} />
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Terms of Service</AlertDialogTitle>
        </AlertDialogHeader>
        <ScrollArea className="max-h-72 pr-1">
          <div className="text-sm text-muted-foreground space-y-3">
            {Array.from({ length: 8 }, (_, i) => (
              <p key={i}>{LOREM}</p>
            ))}
          </div>
        </ScrollArea>
        <AlertDialogFooter>
          <AlertDialogCancel>Decline</AlertDialogCancel>
          <AlertDialogAction>Accept</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 6. Scrollable (sticky header)
export function ScrollableStickyHeaderVariant() {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline">Open</Button>} />
      <AlertDialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <div className="sticky top-0 z-10 bg-popover border-b border-border px-4 pt-4 pb-3">
          <AlertDialogHeader>
            <AlertDialogTitle>Terms of Service</AlertDialogTitle>
          </AlertDialogHeader>
        </div>
        <div className="max-h-72 overflow-y-auto px-4 py-3 text-sm text-muted-foreground space-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <p key={i}>{LOREM}</p>
          ))}
        </div>
        <AlertDialogFooter className="mx-0 mb-0 rounded-b-xl">
          <AlertDialogCancel>Decline</AlertDialogCancel>
          <AlertDialogAction>Accept</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 7. Scrollable (sticky footer)
export function ScrollableStickyFooterVariant() {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline">Open</Button>} />
      <AlertDialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <AlertDialogHeader>
            <AlertDialogTitle>Terms of Service</AlertDialogTitle>
          </AlertDialogHeader>
        </div>
        <div className="max-h-72 overflow-y-auto px-4 text-sm text-muted-foreground space-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <p key={i}>{LOREM}</p>
          ))}
        </div>
        <div className="sticky bottom-0 z-10 bg-popover">
          <AlertDialogFooter className="mx-0 mb-0 rounded-b-xl">
            <AlertDialogCancel>Decline</AlertDialogCancel>
            <AlertDialogAction>Accept</AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 8. Terms & Conditions
export function TermsVariant() {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline">View Terms</Button>} />
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Terms &amp; Conditions</AlertDialogTitle>
          <AlertDialogDescription>
            Please read these terms carefully before using our service.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            By using this service, you agree to our terms of service and privacy
            policy. We reserve the right to modify these terms at any time.
          </p>
          <p>
            Your continued use of the service after changes constitutes
            acceptance of the new terms.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Decline</AlertDialogCancel>
          <AlertDialogAction>I Agree</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 9. Newsletter
export function NewsletterVariant() {
  const [email, setEmail] = React.useState("")
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button>Subscribe</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Subscribe to our newsletter</AlertDialogTitle>
          <AlertDialogDescription>
            Get the latest updates in your inbox.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newsletter-email">Email address</Label>
          <Input
            id="newsletter-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Maybe later</AlertDialogCancel>
          <AlertDialogAction>Subscribe</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 10. Feedback
export function FeedbackVariant() {
  const [feedback, setFeedback] = React.useState("")
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline">Give Feedback</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send feedback</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="feedback-text">Your feedback</Label>
          <Textarea
            id="feedback-text"
            placeholder="Tell us what you think…"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Send feedback</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 11. OTP code
export function OtpVariant() {
  const [otp, setOtp] = React.useState(["", "", "", "", "", ""])
  const refs = Array.from({ length: 6 }, () =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useRef<HTMLInputElement>(null)
  )

  function handleChange(idx: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(-1)
    const next = [...otp]
    next[idx] = digit
    setOtp(next)
    if (digit && idx < 5) {
      refs[idx + 1].current?.focus()
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      refs[idx - 1].current?.focus()
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline">Verify</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enter verification code</AlertDialogTitle>
          <AlertDialogDescription>
            We sent a 6-digit code to your email.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-center gap-2">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={cn(
                "h-10 w-10 rounded-lg border border-input bg-transparent text-center text-base font-semibold",
                "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "transition-colors"
              )}
            />
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Verify</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 12. Sign in
export function SignInVariant() {
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button>Sign in</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign in to your account</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signin-email">Email</Label>
            <Input
              id="signin-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signin-password">Password</Label>
            <Input
              id="signin-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Sign in</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 13. Checkout
export function CheckoutVariant() {
  const lineItems = [
    { label: "Pro Plan", price: "$29.00" },
    { label: "Tax", price: "$2.32" },
  ]
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button>Checkout</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm your order</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border text-sm">
          {lineItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between px-3 py-2">
              <span className="text-muted-foreground">{item.label}</span>
              <span>{item.price}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 font-semibold">
            <span>Total</span>
            <span>$31.32</span>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Pay $31.32</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 14. Change plan
export function ChangePlanVariant() {
  const plans = [
    { id: "free", name: "Free", price: "$0/mo", desc: "For individuals" },
    { id: "pro", name: "Pro", price: "$29/mo", desc: "For small teams" },
    { id: "business", name: "Business", price: "$99/mo", desc: "For organizations" },
  ]
  const [selected, setSelected] = React.useState("pro")

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline">Change plan</Button>} />
      <AlertDialogContent className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Change your plan</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelected(plan.id)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring/50",
                selected === plan.id
                  ? "border-ring bg-primary/5 text-foreground"
                  : "border-border bg-transparent hover:bg-muted"
              )}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "size-4 rounded-full border-2 transition-colors",
                    selected === plan.id
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/40"
                  )}
                />
                <div className="text-left">
                  <p className="font-medium leading-none">{plan.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{plan.desc}</p>
                </div>
              </div>
              <span className="font-semibold">{plan.price}</span>
            </button>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Update plan</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 15. Edit profile
export function EditProfileVariant() {
  const [name, setName] = React.useState("")
  const [username, setUsername] = React.useState("")
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline">Edit profile</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit profile</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-username">Username</Label>
            <Input
              id="profile-username"
              placeholder="@username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Save changes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// 16. Onboarding
export function OnboardingVariant() {
  const steps = [
    "Set up your profile and preferences",
    "Connect your tools and integrations",
    "Invite teammates to collaborate",
  ]
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button>Get started</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Welcome to the app 👋</AlertDialogTitle>
          <AlertDialogDescription>
            Let&apos;s get you set up in a few quick steps.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ol className="flex flex-col gap-2">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <CheckIcon className="size-3 text-primary" />
              </div>
              <span className="text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
        <AlertDialogFooter>
          <AlertDialogCancel>Skip</AlertDialogCancel>
          <AlertDialogAction>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
