export type BillingPeriod = "monthly" | "annual";

export interface PricingFeature {
  text: string;
  included: boolean;
}

export interface PricingTier {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number | null; // null = "Custom"
  annualPrice: number | null;
  badge?: string;
  highlighted: boolean;
  ctaLabel: string;
  ctaVariant: "default" | "outline";
  features: PricingFeature[];
}

export const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    description: "For individuals and small projects just getting started.",
    monthlyPrice: 0,
    annualPrice: 0,
    highlighted: false,
    ctaLabel: "Get Started",
    ctaVariant: "outline",
    features: [
      { text: "Up to 3 projects", included: true },
      { text: "5 GB storage", included: true },
      { text: "Basic analytics", included: true },
      { text: "Email support", included: true },
      { text: "Custom domains", included: false },
      { text: "Team members", included: false },
      { text: "Advanced integrations", included: false },
      { text: "Priority support", included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For professionals and growing teams who need more power.",
    monthlyPrice: 29,
    annualPrice: 23,
    badge: "Most Popular",
    highlighted: true,
    ctaLabel: "Upgrade to Pro",
    ctaVariant: "default",
    features: [
      { text: "Unlimited projects", included: true },
      { text: "50 GB storage", included: true },
      { text: "Advanced analytics", included: true },
      { text: "Priority email support", included: true },
      { text: "Custom domains", included: true },
      { text: "Up to 10 team members", included: true },
      { text: "Advanced integrations", included: false },
      { text: "Dedicated support", included: false },
    ],
  },
  {
    id: "business",
    name: "Business",
    description: "For larger teams and organisations with advanced needs.",
    monthlyPrice: 99,
    annualPrice: 79,
    highlighted: false,
    ctaLabel: "Upgrade to Business",
    ctaVariant: "outline",
    features: [
      { text: "Unlimited projects", included: true },
      { text: "500 GB storage", included: true },
      { text: "Full analytics suite", included: true },
      { text: "Priority email support", included: true },
      { text: "Custom domains", included: true },
      { text: "Unlimited team members", included: true },
      { text: "Advanced integrations", included: true },
      { text: "Dedicated account manager", included: false },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for large enterprises with unique requirements.",
    monthlyPrice: null,
    annualPrice: null,
    highlighted: false,
    ctaLabel: "Contact Sales",
    ctaVariant: "outline",
    features: [
      { text: "Unlimited projects", included: true },
      { text: "Unlimited storage", included: true },
      { text: "Custom analytics", included: true },
      { text: "24/7 dedicated support", included: true },
      { text: "Custom domains", included: true },
      { text: "Unlimited team members", included: true },
      { text: "Advanced integrations", included: true },
      { text: "Dedicated account manager", included: true },
    ],
  },
];

export const faqItems = [
  {
    question: "Can I change my plan later?",
    answer:
      "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately and billing is prorated.",
  },
  {
    question: "Is there a free trial for paid plans?",
    answer:
      "All paid plans include a 14-day free trial. No credit card required to start.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, Amex), as well as PayPal and bank transfers for annual plans.",
  },
  {
    question: "How does annual billing work?",
    answer:
      "Annual billing is charged upfront for the full year at a discounted rate. You save up to 20% compared to monthly billing.",
  },
];
