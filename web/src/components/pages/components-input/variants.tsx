"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Search,
  X,
  Check,
  Phone,
  DollarSign,
  Link2,
  AlertCircle,
} from "lucide-react"

// ─── 1. Basic ─────────────────────────────────────────────────────────────────
export function BasicVariant() {
  return <Input placeholder="Enter text…" />
}

// ─── 2. With Label ────────────────────────────────────────────────────────────
export function WithLabelVariant() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-with-label">Email</Label>
      <Input id="input-with-label" type="email" placeholder="m@example.com" />
    </div>
  )
}

// ─── 3. Email ────────────────────────────────────────────────────────────────
export function EmailVariant() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-email">Email address</Label>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupText>
            <Mail />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id="input-email"
          type="email"
          placeholder="you@example.com"
        />
      </InputGroup>
    </div>
  )
}

// ─── 4. Password (show/hide) ──────────────────────────────────────────────────
export function PasswordShowHideVariant() {
  const [show, setShow] = React.useState(false)

  return (
    <div className="flex flex-col gap-1.5" data-testid="input-password">
      <Label htmlFor="input-password-toggle">Password</Label>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupText>
            <Lock />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id="input-password-toggle"
          type={show ? "text" : "password"}
          placeholder="••••••••"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={show ? "Hide password" : "Show password"}
            onClick={() => setShow((v) => !v)}
          >
            {show ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

// ─── 5. Number ───────────────────────────────────────────────────────────────
export function NumberVariant() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-number">Quantity</Label>
      <Input id="input-number" type="number" placeholder="0" min={0} />
    </div>
  )
}

// ─── 6. Search ────────────────────────────────────────────────────────────────
export function SearchVariant() {
  return (
    <InputGroup>
      <InputGroupAddon align="inline-start">
        <InputGroupText>
          <Search />
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="Search…" type="search" />
    </InputGroup>
  )
}

// ─── 7. File ─────────────────────────────────────────────────────────────────
export function FileVariant() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-file">Upload file</Label>
      <Input id="input-file" type="file" className="cursor-pointer" />
    </div>
  )
}

// ─── 8. Disabled ─────────────────────────────────────────────────────────────
export function DisabledVariant() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-disabled">Disabled</Label>
      <Input
        id="input-disabled"
        disabled
        placeholder="This input is disabled"
      />
    </div>
  )
}

// ─── 9. Readonly ─────────────────────────────────────────────────────────────
export function ReadonlyVariant() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-readonly">Read only</Label>
      <Input
        id="input-readonly"
        readOnly
        value="This value cannot be changed"
        className="bg-muted/40"
      />
    </div>
  )
}

// ─── 10. Leading Icon ─────────────────────────────────────────────────────────
export function LeadingIconVariant() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-leading">Profile URL</Label>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupText>
            <Link2 />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput id="input-leading" placeholder="username" />
      </InputGroup>
    </div>
  )
}

// ─── 11. Trailing Icon ────────────────────────────────────────────────────────
export function TrailingIconVariant() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-trailing">Username</Label>
      <InputGroup>
        <InputGroupInput id="input-trailing" placeholder="johndoe" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>
            <Check className="text-green-500" />
          </InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

// ─── 12. Prefix / URL ─────────────────────────────────────────────────────────
export function PrefixUrlVariant() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-url">Website</Label>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput id="input-url" placeholder="example.com" />
      </InputGroup>
    </div>
  )
}

// ─── 13. Currency ─────────────────────────────────────────────────────────────
export function CurrencyVariant() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-currency">Amount</Label>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupText>
            <DollarSign />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id="input-currency"
          type="number"
          placeholder="0.00"
          min={0}
          step={0.01}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>USD</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

// ─── 14. With Button ──────────────────────────────────────────────────────────
export function WithButtonVariant() {
  return (
    <div className="flex gap-2">
      <Input placeholder="Enter your email…" type="email" />
      <Button size="sm" className="shrink-0">
        Subscribe
      </Button>
    </div>
  )
}

// ─── 15. Clear Button ─────────────────────────────────────────────────────────
export function ClearButtonVariant() {
  const [value, setValue] = React.useState("")

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-clear">Search</Label>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupText>
            <Search />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id="input-clear"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type to search…"
        />
        {value && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label="Clear"
              onClick={() => setValue("")}
            >
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  )
}

// ─── 16. Character Counter ────────────────────────────────────────────────────
export function CharCounterVariant() {
  const MAX = 50
  const [value, setValue] = React.useState("")

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-counter">Bio</Label>
      <Input
        id="input-counter"
        maxLength={MAX}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Tell us about yourself…"
      />
      <p className="text-xs text-muted-foreground text-right">
        {value.length}/{MAX}
      </p>
    </div>
  )
}

// ─── 17. Error State ──────────────────────────────────────────────────────────
export function ErrorStateVariant() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-error">Email</Label>
      <Input
        id="input-error"
        type="email"
        aria-invalid="true"
        placeholder="m@example.com"
        defaultValue=""
      />
      <p className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="size-3.5 shrink-0" />
        This field is required.
      </p>
    </div>
  )
}

// ─── 18. Success State ────────────────────────────────────────────────────────
export function SuccessStateVariant() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-success">Username</Label>
      <Input
        id="input-success"
        defaultValue="johndoe42"
        className="border-green-500 focus-visible:border-green-500 focus-visible:ring-green-500/30"
      />
      <p className="flex items-center gap-1.5 text-xs text-green-600">
        <Check className="size-3.5 shrink-0" />
        Username is available.
      </p>
    </div>
  )
}

// ─── 19. Helper Text ──────────────────────────────────────────────────────────
export function HelperTextVariant() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-helper">Full name</Label>
      <Input id="input-helper" placeholder="John Doe" />
      <p className="text-xs text-muted-foreground">
        Enter your name as it appears on your ID.
      </p>
    </div>
  )
}

// ─── 20. OTP ─────────────────────────────────────────────────────────────────
export function OtpVariant() {
  const LENGTH = 6
  const [otp, setOtp] = React.useState<string[]>(Array(LENGTH).fill(""))
  const refs = React.useRef<(HTMLInputElement | null)[]>([])

  function handleChange(index: number, val: string) {
    const char = val.replace(/\D/g, "").slice(-1)
    const next = [...otp]
    next[index] = char
    setOtp(next)
    if (char && index < LENGTH - 1) {
      refs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      refs.current[index - 1]?.focus()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>One-time password</Label>
      <div className="flex gap-2">
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="h-10 w-10 rounded-lg border border-input bg-transparent text-center text-sm font-medium outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label={`OTP digit ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

// ─── 21. Phone ────────────────────────────────────────────────────────────────
export function PhoneVariant() {
  const [code, setCode] = React.useState("+1")

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-phone">Phone number</Label>
      <div className="flex gap-2">
        <Select value={code} onValueChange={(v) => setCode(v ?? "+1")}>
          <SelectTrigger className="w-24 shrink-0">
            <Phone className="size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="+1">+1</SelectItem>
            <SelectItem value="+44">+44</SelectItem>
            <SelectItem value="+91">+91</SelectItem>
          </SelectContent>
        </Select>
        <Input
          id="input-phone"
          type="tel"
          placeholder="(555) 000-0000"
          className="flex-1"
        />
      </div>
    </div>
  )
}

// ─── 22. Password Strength ────────────────────────────────────────────────────
export function PasswordStrengthVariant() {
  const [value, setValue] = React.useState("")
  const [show, setShow] = React.useState(false)

  const checks = {
    length: value.length >= 8,
    upper: /[A-Z]/.test(value),
    number: /[0-9]/.test(value),
  }
  const score = Object.values(checks).filter(Boolean).length
  const strengthColor =
    score === 0
      ? "bg-muted"
      : score === 1
        ? "bg-destructive"
        : score === 2
          ? "bg-yellow-500"
          : "bg-green-500"
  const strengthPct = Math.round((score / 3) * 100)

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="input-strength">Password</Label>
      <InputGroup>
        <InputGroupInput
          id="input-strength"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Create a password"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={show ? "Hide password" : "Show password"}
            onClick={() => setShow((v) => !v)}
          >
            {show ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {/* Strength bar */}
      <div className="relative flex h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all duration-300", strengthColor)}
          style={{ width: `${strengthPct}%` }}
        />
      </div>

      {/* Requirements */}
      <ul className="flex flex-col gap-0.5 text-xs">
        {[
          { key: "length", label: "At least 8 characters" },
          { key: "upper",  label: "Uppercase letter" },
          { key: "number", label: "Contains a number" },
        ].map(({ key, label }) => (
          <li
            key={key}
            className={cn(
              "flex items-center gap-1.5",
              checks[key as keyof typeof checks]
                ? "text-green-600"
                : "text-muted-foreground"
            )}
          >
            {checks[key as keyof typeof checks] ? (
              <Check className="size-3" />
            ) : (
              <X className="size-3" />
            )}
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── 23. Date ─────────────────────────────────────────────────────────────────
export function DateVariant() {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-date">Date of birth</Label>
      <Input id="input-date" type="date" />
    </div>
  )
}

// ─── 24. Tags ─────────────────────────────────────────────────────────────────
export function TagsVariant() {
  const [tags, setTags] = React.useState(["design", "react"])
  const [input, setInput] = React.useState("")

  function addTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault()
      const tag = input.trim().toLowerCase()
      if (!tags.includes(tag)) {
        setTags((prev) => [...prev, tag])
      }
      setInput("")
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="input-tags">Tags</Label>
      <div className="min-h-8 flex flex-wrap gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 transition-colors">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => removeTag(tag)}
              className="hover:text-destructive transition-colors"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id="input-tags"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={addTag}
          placeholder={tags.length === 0 ? "Add tags…" : ""}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <p className="text-xs text-muted-foreground">Press Enter to add a tag.</p>
    </div>
  )
}

// ─── 25. Sizes ────────────────────────────────────────────────────────────────
export function SizesVariant() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Small</Label>
        <Input
          placeholder="Small input"
          className="h-7 px-2 text-xs"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Default</Label>
        <Input placeholder="Default input" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Large</Label>
        <Input
          placeholder="Large input"
          className="h-10 px-3 text-base"
        />
      </div>
    </div>
  )
}
