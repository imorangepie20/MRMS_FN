"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, MinusIcon, CircleHelpIcon } from "lucide-react"

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

// Shared FAQ data
const FAQ_ITEMS = [
  {
    value: "pricing",
    question: "What pricing plans are available?",
    subtitle: "Compare our plans and pick what fits.",
    answer:
      "We offer Free, Pro ($29/mo), and Business ($99/mo) plans. Each tier unlocks more seats, storage, and integrations.",
  },
  {
    value: "change-plan",
    question: "Can I change my plan later?",
    subtitle: "Upgrade or downgrade any time.",
    answer:
      "Yes — you can upgrade or downgrade at any time from your billing settings. Changes take effect immediately.",
  },
  {
    value: "free-trial",
    question: "Is there a free trial?",
    subtitle: "No credit card required to start.",
    answer:
      "All paid plans include a 14-day free trial. No credit card is required to get started.",
  },
  {
    value: "payment",
    question: "What payment methods do you accept?",
    subtitle: "Visa, Mastercard, PayPal, and more.",
    answer:
      "We accept Visa, Mastercard, American Express, and PayPal. Annual plans also support bank transfers.",
  },
  {
    value: "cancel",
    question: "How do I cancel my subscription?",
    subtitle: "Cancel any time, no lock-in.",
    answer:
      "You can cancel from the Billing page. Your account stays active until the end of the current billing period.",
  },
]

// ─── 1. Basic ────────────────────────────────────────────────────────────────
export function BasicVariant() {
  return (
    <Accordion className="w-full">
      {FAQ_ITEMS.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

// ─── 2. Plus icon ────────────────────────────────────────────────────────────
// Custom trigger that replaces chevrons with Plus/Minus
function PlusTrigger({
  children,
  className,
  ...props
}: React.ComponentProps<typeof AccordionTrigger>) {
  const [open, setOpen] = React.useState(false)
  return (
    <AccordionTrigger
      className={cn("[&_[data-slot=accordion-trigger-icon]]:hidden", className)}
      onClick={() => setOpen((v) => !v)}
      {...props}
    >
      {children}
      {open ? (
        <MinusIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
      ) : (
        <PlusIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
      )}
    </AccordionTrigger>
  )
}

export function PlusIconVariant() {
  return (
    <Accordion className="w-full">
      {FAQ_ITEMS.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <PlusTrigger>{item.question}</PlusTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

// ─── 3. Icon on the left ─────────────────────────────────────────────────────
function LeftIconTrigger({
  children,
  className,
  ...props
}: React.ComponentProps<typeof AccordionTrigger>) {
  return (
    <AccordionTrigger
      className={cn(
        "flex-row-reverse justify-end gap-2 [&_[data-slot=accordion-trigger-icon]]:ml-0 [&_[data-slot=accordion-trigger-icon]]:mr-auto",
        className
      )}
      {...props}
    >
      {children}
    </AccordionTrigger>
  )
}

export function IconOnLeftVariant() {
  return (
    <Accordion className="w-full">
      {FAQ_ITEMS.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <LeftIconTrigger>{item.question}</LeftIconTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

// ─── 4. With subtext ─────────────────────────────────────────────────────────
export function WithSubtextVariant() {
  return (
    <Accordion className="w-full">
      {FAQ_ITEMS.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>
            <span className="flex flex-col items-start gap-0.5">
              <span>{item.question}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {item.subtitle}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

// ─── 5. With subtext + icon ───────────────────────────────────────────────────
export function WithSubtextAndIconVariant() {
  return (
    <Accordion className="w-full">
      {FAQ_ITEMS.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger
            className="[&_[data-slot=accordion-trigger-icon]]:ml-0 [&_[data-slot=accordion-trigger-icon]]:mr-auto gap-3 flex-row-reverse justify-end"
          >
            <span className="flex flex-col items-start gap-0.5">
              <span>{item.question}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {item.subtitle}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

// ─── 6. Stacked ───────────────────────────────────────────────────────────────
export function StackedVariant() {
  return (
    <Accordion className="flex w-full flex-col gap-2">
      {FAQ_ITEMS.map((item) => (
        <AccordionItem
          key={item.value}
          value={item.value}
          className="rounded-lg border border-border px-3 not-last:border-b"
        >
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

// ─── 7. Stacked + left icon ───────────────────────────────────────────────────
export function StackedLeftIconVariant() {
  return (
    <Accordion className="flex w-full flex-col gap-2">
      {FAQ_ITEMS.map((item) => (
        <AccordionItem
          key={item.value}
          value={item.value}
          className="rounded-lg border border-border px-3 not-last:border-b"
        >
          <LeftIconTrigger>{item.question}</LeftIconTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

// ─── 8. Active state (first open by default) ─────────────────────────────────
export function ActiveStateVariant() {
  return (
    <Accordion className="w-full" defaultValue={["pricing"]}>
      {FAQ_ITEMS.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

// ─── 9. Bordered ─────────────────────────────────────────────────────────────
export function BorderedVariant() {
  return (
    <Accordion className="w-full">
      {FAQ_ITEMS.map((item) => (
        <AccordionItem
          key={item.value}
          value={item.value}
          className="rounded-lg border border-border px-3 not-last:mb-px not-last:border-b"
        >
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

// ─── 10. Multiple ─────────────────────────────────────────────────────────────
export function MultipleVariant() {
  return (
    <Accordion className="w-full" multiple>
      {FAQ_ITEMS.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

// ─── 11. Disabled item ────────────────────────────────────────────────────────
export function DisabledItemVariant() {
  return (
    <Accordion className="w-full">
      {FAQ_ITEMS.map((item, index) => (
        <AccordionItem key={item.value} value={item.value} disabled={index === 2}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

// ─── 12. Ghost / filled ───────────────────────────────────────────────────────
export function GhostFilledVariant() {
  return (
    <Accordion className="flex w-full flex-col gap-1">
      {FAQ_ITEMS.map((item) => (
        <AccordionItem
          key={item.value}
          value={item.value}
          className="rounded-lg bg-muted/40 px-3 not-last:border-b-0"
        >
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
