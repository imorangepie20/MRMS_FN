import Link from "next/link"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  StandardVariant,
  LoginFormVariant,
  BlogImageVariant,
  HelpActionVariant,
  TabbedVariant,
  CookieConsentVariant,
  EmptyStateVariant,
  StatsMetricVariant,
} from "@/components/pages/components-card/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Standard",
    description: "A basic card with header, content, and footer action row.",
    component: StandardVariant,
  },
  {
    title: "Login / Form",
    description: "A login form inside a card with email, password, and sign-in actions.",
    component: LoginFormVariant,
  },
  {
    title: "Blog / Image",
    description: "A card with a gradient image area on top, ideal for blog posts.",
    component: BlogImageVariant,
  },
  {
    title: "Help / Action",
    description: "A step-by-step help card with numbered instructions.",
    component: HelpActionVariant,
  },
  {
    title: "Tabbed",
    description: "A card with tabs to switch between Overview, Analytics, and Settings.",
    component: TabbedVariant,
  },
  {
    title: "Cookie consent",
    description: "A cookie consent notice with Reject and Accept All actions.",
    component: CookieConsentVariant,
  },
  {
    title: "Empty state",
    description: "A card showing an empty state with an icon and an invite call-to-action.",
    component: EmptyStateVariant,
  },
  {
    title: "Stats / Metric",
    description: "A metric card displaying a key figure with a percentage delta.",
    component: StatsMetricVariant,
  },
]

export default function CardPage() {
  return (
    <div className="flex flex-col gap-8 p-6 pb-12">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/components" />}>
              Components
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Card</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Card</h1>
        <p className="text-sm text-muted-foreground">
          Displays a card with header, content, and footer. Browse our collection of{" "}
          {VARIANTS.length} Card variants.
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {VARIANTS.map(({ title, description, component: Component }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardHeader>
            <CardContent className="py-4">
              <Component />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
