"use client"

import * as React from "react"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Mail,
  MessageSquare,
  Bell,
  CreditCard,
  Truck,
  Store,
  Star,
  User,
  Building2,
  Cpu,
  Globe,
} from "lucide-react"

// ─── 1. Basic ─────────────────────────────────────────────────────────────────
export function BasicVariant() {
  const [value, setValue] = React.useState("default")
  return (
    <RadioGroup
      data-testid="radio-basic"
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      <div className="flex items-center gap-2">
        <RadioGroupItem value="default" id="basic-default" />
        <Label htmlFor="basic-default">Default</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="comfortable" id="basic-comfortable" />
        <Label htmlFor="basic-comfortable">Comfortable</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="compact" id="basic-compact" />
        <Label htmlFor="basic-compact">Compact</Label>
      </div>
    </RadioGroup>
  )
}

// ─── 2. With descriptions ─────────────────────────────────────────────────────
export function WithDescriptionsVariant() {
  const [value, setValue] = React.useState("comfortable")
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      <div className="flex items-start gap-3">
        <RadioGroupItem value="default" id="desc-default" className="mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="desc-default">Default</Label>
          <p className="text-xs text-muted-foreground">Best for most users.</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <RadioGroupItem value="comfortable" id="desc-comfortable" className="mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="desc-comfortable">Comfortable</Label>
          <p className="text-xs text-muted-foreground">Extra spacing for readability.</p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <RadioGroupItem value="compact" id="desc-compact" className="mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="desc-compact">Compact</Label>
          <p className="text-xs text-muted-foreground">Dense layout for power users.</p>
        </div>
      </div>
    </RadioGroup>
  )
}

// ─── 3. Card ──────────────────────────────────────────────────────────────────
const CARD_OPTIONS = [
  { value: "starter", label: "Starter", description: "Great for personal projects." },
  { value: "pro", label: "Pro", description: "For growing teams and businesses." },
  { value: "enterprise", label: "Enterprise", description: "Advanced features for large orgs." },
]

export function CardVariant() {
  const [value, setValue] = React.useState("pro")
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
      className="gap-2"
    >
      {CARD_OPTIONS.map((opt) => (
        <label
          key={opt.value}
          htmlFor={`card-${opt.value}`}
          className={cn(
            "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors",
            value === opt.value
              ? "border-primary bg-primary/5"
              : "hover:border-muted-foreground/30"
          )}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value={opt.value} id={`card-${opt.value}`} className="sr-only" />
            <p className="text-sm font-medium">{opt.label}</p>
          </div>
          <p className="text-xs text-muted-foreground">{opt.description}</p>
        </label>
      ))}
    </RadioGroup>
  )
}

// ─── 4. Billing frequency ─────────────────────────────────────────────────────
export function BillingFrequencyVariant() {
  const [value, setValue] = React.useState("monthly")
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
      className="flex flex-row flex-wrap gap-4"
    >
      {[
        { value: "monthly", label: "Monthly" },
        { value: "quarterly", label: "Quarterly" },
        { value: "yearly", label: "Yearly" },
      ].map((opt) => (
        <div key={opt.value} className="flex items-center gap-2">
          <RadioGroupItem value={opt.value} id={`billing-${opt.value}`} />
          <Label htmlFor={`billing-${opt.value}`}>{opt.label}</Label>
        </div>
      ))}
    </RadioGroup>
  )
}

// ─── 5. Contact method ────────────────────────────────────────────────────────
export function ContactMethodVariant() {
  const [value, setValue] = React.useState("email")
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      <div className="flex items-center gap-3">
        <RadioGroupItem value="email" id="contact-email" />
        <Mail className="size-4 text-muted-foreground" />
        <Label htmlFor="contact-email">Email</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="sms" id="contact-sms" />
        <MessageSquare className="size-4 text-muted-foreground" />
        <Label htmlFor="contact-sms">SMS</Label>
      </div>
      <div className="flex items-center gap-3">
        <RadioGroupItem value="push" id="contact-push" />
        <Bell className="size-4 text-muted-foreground" />
        <Label htmlFor="contact-push">Push</Label>
      </div>
    </RadioGroup>
  )
}

// ─── 6. Payment method ────────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  { value: "card", label: "Credit Card", icon: CreditCard },
  { value: "paypal", label: "PayPal", icon: Globe },
  { value: "apple", label: "Apple Pay", icon: CreditCard },
]

export function PaymentMethodVariant() {
  const [value, setValue] = React.useState("card")
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
      className="gap-2"
    >
      {PAYMENT_METHODS.map(({ value: val, label, icon: Icon }) => (
        <label
          key={val}
          htmlFor={`payment-${val}`}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
            value === val
              ? "border-primary bg-primary/5"
              : "hover:border-muted-foreground/30"
          )}
        >
          <RadioGroupItem value={val} id={`payment-${val}`} className="sr-only" />
          <Icon className="size-5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">{label}</span>
        </label>
      ))}
    </RadioGroup>
  )
}

// ─── 7. Delivery options ──────────────────────────────────────────────────────
export function DeliveryOptionsVariant() {
  const [value, setValue] = React.useState("home")
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
      className="gap-2"
    >
      <label
        htmlFor="delivery-home"
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
          value === "home" ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
        )}
      >
        <RadioGroupItem value="home" id="delivery-home" className="mt-0.5 sr-only" />
        <Truck className="size-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Home delivery</span>
          <span className="text-xs text-muted-foreground">Delivered to your door in 2–5 days.</span>
        </div>
      </label>
      <label
        htmlFor="delivery-store"
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
          value === "store" ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
        )}
      >
        <RadioGroupItem value="store" id="delivery-store" className="mt-0.5 sr-only" />
        <Store className="size-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Store pickup</span>
          <span className="text-xs text-muted-foreground">Pick up from your nearest store today.</span>
        </div>
      </label>
    </RadioGroup>
  )
}

// ─── 8. Rating filter ─────────────────────────────────────────────────────────
export function RatingFilterVariant() {
  const [value, setValue] = React.useState("5")
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      {["5", "4", "3", "2", "1"].map((stars) => (
        <div key={stars} className="flex items-center gap-2">
          <RadioGroupItem value={stars} id={`rating-${stars}`} />
          <label
            htmlFor={`rating-${stars}`}
            className="flex cursor-pointer items-center gap-1"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "size-4",
                  i < Number(stars)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30"
                )}
              />
            ))}
            <span className="ml-1 text-sm text-muted-foreground">{stars} star{stars !== "1" ? "s" : ""}</span>
          </label>
        </div>
      ))}
    </RadioGroup>
  )
}

// ─── 9. Product color ─────────────────────────────────────────────────────────
const COLORS = [
  { value: "black", label: "Black", bg: "bg-zinc-900" },
  { value: "red", label: "Red", bg: "bg-red-500" },
  { value: "blue", label: "Blue", bg: "bg-blue-500" },
  { value: "green", label: "Green", bg: "bg-emerald-500" },
]

export function ProductColorVariant() {
  const [value, setValue] = React.useState("black")
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Select color</p>
      <RadioGroup
        value={value}
        onValueChange={(v) => { if (v != null) setValue(v) }}
        className="flex flex-row gap-3"
      >
        {COLORS.map((color) => (
          <label key={color.value} htmlFor={`color-${color.value}`} className="cursor-pointer">
            <RadioGroupItem
              value={color.value}
              id={`color-${color.value}`}
              className="sr-only"
              aria-label={color.label}
            />
            <span
              className={cn(
                "flex size-8 rounded-full transition-all",
                color.bg,
                value === color.value
                  ? "ring-2 ring-primary ring-offset-2"
                  : "ring-1 ring-border/50"
              )}
            />
          </label>
        ))}
      </RadioGroup>
      <p className="text-xs text-muted-foreground capitalize">{value}</p>
    </div>
  )
}

// ─── 10. Plan selection ───────────────────────────────────────────────────────
export function PlanSelectionVariant() {
  const [value, setValue] = React.useState("pro")
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
      className="gap-2"
    >
      <label
        htmlFor="plan-starter"
        className={cn(
          "flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors",
          value === "starter" ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
        )}
      >
        <RadioGroupItem value="starter" id="plan-starter" className="sr-only" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Starter</span>
          <span className="text-sm font-semibold">Free</span>
        </div>
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <li>5 projects</li>
          <li>1 GB storage</li>
          <li>Community support</li>
        </ul>
      </label>
      <label
        htmlFor="plan-professional"
        className={cn(
          "relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors",
          value === "pro" ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
        )}
      >
        <RadioGroupItem value="pro" id="plan-professional" className="sr-only" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Professional</span>
            <Badge variant="default" className="h-4 text-[10px]">Recommended</Badge>
          </div>
          <span className="text-sm font-semibold">$29/mo</span>
        </div>
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <li>Unlimited projects</li>
          <li>50 GB storage</li>
          <li>Priority support</li>
        </ul>
      </label>
    </RadioGroup>
  )
}

// ─── 11. Compute resources ────────────────────────────────────────────────────
const CPU_OPTIONS = ["2", "4", "6", "8", "12", "16"]

export function ComputeResourcesVariant() {
  const [value, setValue] = React.useState("4")
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Cpu className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">CPU Cores</p>
      </div>
      <RadioGroup
        value={value}
        onValueChange={(v) => { if (v != null) setValue(v) }}
        className="grid grid-cols-3 gap-2"
      >
        {CPU_OPTIONS.map((cores) => (
          <label
            key={cores}
            htmlFor={`cpu-${cores}`}
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-md border p-2 text-sm font-medium transition-colors",
              value === cores
                ? "border-primary bg-primary/10 text-primary"
                : "hover:border-muted-foreground/30"
            )}
          >
            <RadioGroupItem value={cores} id={`cpu-${cores}`} className="sr-only" />
            {cores}
          </label>
        ))}
      </RadioGroup>
    </div>
  )
}

// ─── 12. Data center region ───────────────────────────────────────────────────
export function DataCenterRegionVariant() {
  const [value, setValue] = React.useState("us")
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      {[
        { value: "us", label: "North America", sub: "us-east-1, us-west-2" },
        { value: "eu", label: "Europe", sub: "eu-west-1, eu-central-1" },
        { value: "ap", label: "Asia Pacific", sub: "ap-southeast-1, ap-northeast-1" },
      ].map((region) => (
        <div key={region.value} className="flex items-start gap-3">
          <RadioGroupItem value={region.value} id={`region-${region.value}`} className="mt-0.5" />
          <Globe className="size-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor={`region-${region.value}`}>{region.label}</Label>
            <p className="text-xs text-muted-foreground">{region.sub}</p>
          </div>
        </div>
      ))}
    </RadioGroup>
  )
}

// ─── 13. Subscription plans ───────────────────────────────────────────────────
const SUBSCRIPTION_PLANS = [
  { value: "basic", label: "Basic", price: "$9/mo" },
  { value: "pro", label: "Pro", price: "$29/mo" },
  { value: "business", label: "Business", price: "$79/mo" },
  { value: "enterprise", label: "Enterprise", price: "Custom" },
]

export function SubscriptionPlansVariant() {
  const [value, setValue] = React.useState("pro")
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
      className="gap-2"
    >
      {SUBSCRIPTION_PLANS.map((plan) => (
        <label
          key={plan.value}
          htmlFor={`sub-${plan.value}`}
          className={cn(
            "flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-colors",
            value === plan.value
              ? "border-primary bg-primary/5"
              : "hover:border-muted-foreground/30"
          )}
        >
          <div className="flex items-center gap-3">
            <RadioGroupItem value={plan.value} id={`sub-${plan.value}`} className="sr-only" />
            <span className="text-sm font-medium">{plan.label}</span>
          </div>
          <span className="text-sm text-muted-foreground">{plan.price}</span>
        </label>
      ))}
    </RadioGroup>
  )
}

// ─── 14. Account type ─────────────────────────────────────────────────────────
export function AccountTypeVariant() {
  const [value, setValue] = React.useState("personal")
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
      className="gap-2"
    >
      <label
        htmlFor="account-personal"
        className={cn(
          "flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors",
          value === "personal" ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
        )}
      >
        <RadioGroupItem value="personal" id="account-personal" className="mt-0.5 sr-only" />
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="size-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Personal</span>
          <p className="text-xs text-muted-foreground">
            For individuals managing personal projects and tasks.
          </p>
        </div>
      </label>
      <label
        htmlFor="account-business"
        className={cn(
          "flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors",
          value === "business" ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
        )}
      >
        <RadioGroupItem value="business" id="account-business" className="mt-0.5 sr-only" />
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <Building2 className="size-5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold">Business</span>
          <p className="text-xs text-muted-foreground">
            For teams and organizations with advanced collaboration needs.
          </p>
        </div>
      </label>
    </RadioGroup>
  )
}

// ─── 15. Disabled ─────────────────────────────────────────────────────────────
export function DisabledVariant() {
  const [value, setValue] = React.useState("option-a")
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => { if (v != null) setValue(v) }}
    >
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option-a" id="disabled-option-a" />
        <Label htmlFor="disabled-option-a">Option A</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option-b" id="disabled-option-b" disabled />
        <Label htmlFor="disabled-option-b" className="opacity-50">
          Option B (disabled)
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="option-c" id="disabled-option-c" />
        <Label htmlFor="disabled-option-c">Option C</Label>
      </div>
    </RadioGroup>
  )
}
