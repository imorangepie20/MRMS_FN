"use client"

import * as React from "react"

import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// ─── 1. Payment Method ───────────────────────────────────────────────────────
export function PaymentMethodVariant() {
  return (
    <FieldSet>
      <FieldLegend>Card Details</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="card-number">Card Number</FieldLabel>
          <Input id="card-number" placeholder="4242 4242 4242 4242" />
        </Field>
        <div className="flex gap-3">
          <Field className="flex-1">
            <FieldLabel htmlFor="expiry">Expiration</FieldLabel>
            <Input id="expiry" placeholder="MM/YY" />
          </Field>
          <Field className="flex-1">
            <FieldLabel htmlFor="cvv">CVV</FieldLabel>
            <Input id="cvv" placeholder="123" />
          </Field>
        </div>
        <FieldDescription>Enter your card information.</FieldDescription>
      </FieldGroup>
    </FieldSet>
  )
}

// ─── 2. Billing Address ───────────────────────────────────────────────────────
export function BillingAddressVariant() {
  const [sameAsShipping, setSameAsShipping] = React.useState(false)

  return (
    <FieldGroup data-testid="field-billing">
      <Field>
        <FieldLabel htmlFor="billing-address">Address</FieldLabel>
        <Input id="billing-address" placeholder="123 Main St" />
      </Field>
      <Field orientation="horizontal">
        <Checkbox
          id="same-as-shipping"
          checked={sameAsShipping}
          onCheckedChange={(v) => setSameAsShipping(!!v)}
          aria-label="Same as shipping address"
        />
        <FieldLabel htmlFor="same-as-shipping">
          Same as shipping address
        </FieldLabel>
      </Field>
    </FieldGroup>
  )
}

// ─── 3. Comments ──────────────────────────────────────────────────────────────
export function CommentsVariant() {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="comment">Comment</FieldLabel>
        <Textarea id="comment" placeholder="Leave a comment…" rows={3} />
        <FieldDescription>
          Share your thoughts or feedback with us.
        </FieldDescription>
      </Field>
      <div className="flex gap-2">
        <Button size="sm">Submit</Button>
        <Button variant="outline" size="sm">Cancel</Button>
      </div>
    </FieldGroup>
  )
}

// ─── 4. Username ──────────────────────────────────────────────────────────────
export function UsernameVariant() {
  return (
    <Field>
      <FieldLabel htmlFor="username">Username</FieldLabel>
      <Input id="username" placeholder="johndoe" />
      <FieldDescription>
        This is your public display name.
      </FieldDescription>
    </Field>
  )
}

// ─── 5. Password ──────────────────────────────────────────────────────────────
export function PasswordVariant() {
  return (
    <Field>
      <FieldLabel htmlFor="password">Password</FieldLabel>
      <Input id="password" type="password" placeholder="••••••••" />
      <FieldError>Must be at least 8 characters.</FieldError>
    </Field>
  )
}

// ─── 6. Feedback ─────────────────────────────────────────────────────────────
export function FeedbackVariant() {
  return (
    <Field>
      <FieldLabel htmlFor="feedback">Feedback</FieldLabel>
      <Textarea id="feedback" placeholder="Tell us what you think…" rows={4} />
      <FieldDescription>Your feedback helps us improve.</FieldDescription>
    </Field>
  )
}

// ─── 7. Department ───────────────────────────────────────────────────────────
export function DepartmentVariant() {
  const [dept, setDept] = React.useState<string | undefined>(undefined)

  return (
    <Field>
      <FieldLabel htmlFor="department-trigger">Department</FieldLabel>
      <Select value={dept ?? null} onValueChange={(v) => setDept(v ?? undefined)}>
        <SelectTrigger id="department-trigger" className="w-full">
          <SelectValue placeholder="Select department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="engineering">Engineering</SelectItem>
          <SelectItem value="design">Design</SelectItem>
          <SelectItem value="marketing">Marketing</SelectItem>
          <SelectItem value="sales">Sales</SelectItem>
        </SelectContent>
      </Select>
      <FieldDescription>
        Choose the department you belong to.
      </FieldDescription>
    </Field>
  )
}

// ─── 8. Notifications (switch) ────────────────────────────────────────────────
export function NotificationsVariant() {
  const [enabled, setEnabled] = React.useState(false)

  return (
    <Field orientation="horizontal">
      <div className="flex flex-1 flex-col gap-0.5">
        <FieldLabel htmlFor="notifications-switch">
          Email Notifications
        </FieldLabel>
        <FieldDescription>Receive email notifications.</FieldDescription>
      </div>
      <Switch
        id="notifications-switch"
        checked={enabled}
        onCheckedChange={(v) => setEnabled(!!v)}
      />
    </Field>
  )
}

// ─── 9. Address (fieldset) ───────────────────────────────────────────────────
export function AddressFieldsetVariant() {
  const [country, setCountry] = React.useState<string | undefined>(undefined)

  return (
    <FieldSet>
      <FieldLegend>Address</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="street">Street</FieldLabel>
          <Input id="street" placeholder="123 Main St" />
        </Field>
        <div className="flex gap-3">
          <Field className="flex-1">
            <FieldLabel htmlFor="city">City</FieldLabel>
            <Input id="city" placeholder="New York" />
          </Field>
          <Field className="flex-1">
            <FieldLabel htmlFor="postal">Postal code</FieldLabel>
            <Input id="postal" placeholder="10001" />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="country-trigger">Country</FieldLabel>
          <Select value={country ?? null} onValueChange={(v) => setCountry(v ?? undefined)}>
            <SelectTrigger id="country-trigger" className="w-full">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="us">United States</SelectItem>
              <SelectItem value="ca">Canada</SelectItem>
              <SelectItem value="gb">United Kingdom</SelectItem>
              <SelectItem value="au">Australia</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </FieldSet>
  )
}

// ─── 10. Subscription (radio) ─────────────────────────────────────────────────
export function SubscriptionVariant() {
  const [plan, setPlan] = React.useState("free")

  const plans = [
    { value: "free",       label: "Free",       price: "$0/mo",   desc: "For personal projects" },
    { value: "pro",        label: "Pro",         price: "$12/mo",  desc: "For professionals" },
    { value: "enterprise", label: "Enterprise",  price: "$49/mo",  desc: "For teams & orgs" },
  ]

  return (
    <Field>
      <FieldLabel>Subscription Plan</FieldLabel>
      <RadioGroup
        value={plan}
        onValueChange={(v) => setPlan(v ?? "free")}
        className="flex flex-col gap-2 pt-1"
      >
        {plans.map(({ value, label, price, desc }) => (
          <Label
            key={value}
            htmlFor={`plan-${value}`}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
              plan === value
                ? "border-primary bg-primary/5"
                : "border-input hover:bg-muted/40"
            )}
          >
            <RadioGroupItem id={`plan-${value}`} value={value} />
            <div className="flex flex-1 items-center justify-between gap-2">
              <span className="text-sm font-medium">{label}</span>
              <div className="text-right">
                <span className="text-xs font-semibold">{price}</span>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          </Label>
        ))}
      </RadioGroup>
    </Field>
  )
}
