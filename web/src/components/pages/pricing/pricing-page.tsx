"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { type BillingPeriod, pricingTiers, faqItems } from "./data";

// ─── Billing Toggle ─────────────────────────────────────────────────────────

function BillingToggle({
  value,
  onChange,
}: {
  value: BillingPeriod;
  onChange: (v: BillingPeriod) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "text-sm font-medium transition-colors cursor-pointer",
          value === "monthly" ? "text-foreground" : "text-muted-foreground"
        )}
        onClick={() => onChange("monthly")}
      >
        Monthly
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value === "annual"}
        onClick={() => onChange(value === "monthly" ? "annual" : "monthly")}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          value === "annual" ? "bg-primary" : "bg-input"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform",
            value === "annual" ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
      <span
        className={cn(
          "text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5",
          value === "annual" ? "text-foreground" : "text-muted-foreground"
        )}
        onClick={() => onChange("annual")}
      >
        Annual
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
          Save 20%
        </Badge>
      </span>
    </div>
  );
}

// ─── Price Display ───────────────────────────────────────────────────────────

function PriceDisplay({
  tier,
  billing,
}: {
  tier: (typeof pricingTiers)[0];
  billing: BillingPeriod;
}) {
  const price = billing === "monthly" ? tier.monthlyPrice : tier.annualPrice;

  if (price === null) {
    return (
      <div className="flex items-baseline gap-1 mt-3 mb-1">
        <span className="text-3xl font-bold tracking-tight">Custom</span>
      </div>
    );
  }

  if (price === 0) {
    return (
      <div className="flex items-baseline gap-1 mt-3 mb-1">
        <span className="text-3xl font-bold tracking-tight">Free</span>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-1 mt-3 mb-1">
      <span className="text-xl font-medium text-muted-foreground">$</span>
      <span className="text-3xl font-bold tracking-tight tabular-nums">{price}</span>
      <span className="text-sm text-muted-foreground">/mo</span>
    </div>
  );
}

// ─── Tier Card ───────────────────────────────────────────────────────────────

function TierCard({
  tier,
  billing,
}: {
  tier: (typeof pricingTiers)[0];
  billing: BillingPeriod;
}) {
  return (
    <Card
      className={cn(
        "relative flex flex-col transition-shadow hover:shadow-md",
        tier.highlighted &&
          "ring-2 ring-primary shadow-lg"
      )}
    >
      {tier.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="text-xs px-2.5 py-0.5 h-6 shadow-sm">{tier.badge}</Badge>
        </div>
      )}
      <CardHeader className={cn("pb-0", tier.highlighted && "pt-6")}>
        <CardTitle className="text-base font-semibold">{tier.name}</CardTitle>
        <CardDescription className="text-sm leading-relaxed mt-1">
          {tier.description}
        </CardDescription>
        <PriceDisplay tier={tier} billing={billing} />
        {billing === "annual" &&
          tier.annualPrice !== null &&
          tier.annualPrice > 0 && (
            <p className="text-xs text-muted-foreground">
              Billed ${(tier.annualPrice * 12).toLocaleString()} annually
            </p>
          )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-4 flex-1">
        <Separator />
        <ul className="flex flex-col gap-2.5">
          {tier.features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm">
              {feature.included ? (
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Check className="size-2.5 text-primary" />
                </span>
              ) : (
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted">
                  <X className="size-2.5 text-muted-foreground" />
                </span>
              )}
              <span
                className={cn(
                  feature.included
                    ? "text-foreground"
                    : "text-muted-foreground line-through decoration-muted-foreground/40"
                )}
              >
                {feature.text}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="bg-transparent border-0 pt-4">
        <Button
          variant={tier.highlighted ? "default" : "outline"}
          className="w-full"
        >
          {tier.ctaLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ─── FAQ Section ─────────────────────────────────────────────────────────────

function FaqSection() {
  return (
    <div className="mt-16 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-center mb-8">
        Frequently asked questions
      </h2>
      <div className="flex flex-col gap-4">
        {faqItems.map((item, i) => (
          <Card key={i} size="sm">
            <CardContent className="py-4">
              <p className="font-medium text-sm mb-1.5">{item.question}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.answer}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Pricing Page ────────────────────────────────────────────────────────────

export function PricingPage() {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex flex-col items-center gap-4 pb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          Choose the plan that fits your needs. Upgrade or downgrade at any time.
          All plans include a 14-day free trial.
        </p>
        <BillingToggle value={billing} onChange={setBilling} />
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {pricingTiers.map((tier) => (
          <TierCard key={tier.id} tier={tier} billing={billing} />
        ))}
      </div>

      {/* FAQ */}
      <FaqSection />
    </div>
  );
}
