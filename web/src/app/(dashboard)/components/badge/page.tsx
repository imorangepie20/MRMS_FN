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
  DefaultVariant,
  SecondaryVariant,
  DestructiveVariant,
  OutlineVariant,
  WithLeadingIconVariant,
  WithTrailingIconVariant,
  WithDotVariant,
  ColoredVariant,
  NumberCountVariant,
  RemovableVariant,
  SoftVariant,
  SizesVariant,
} from "@/components/pages/components-badge/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Default",
    description: "The standard badge using the primary color palette.",
    component: DefaultVariant,
  },
  {
    title: "Secondary",
    description: "A muted secondary palette for lower-emphasis labels.",
    component: SecondaryVariant,
  },
  {
    title: "Destructive",
    description: "Signals an error or failed state with a red tint.",
    component: DestructiveVariant,
  },
  {
    title: "Outline",
    description: "Bordered badge with a transparent background.",
    component: OutlineVariant,
  },
  {
    title: "With leading icon",
    description: "An icon precedes the label for added context.",
    component: WithLeadingIconVariant,
  },
  {
    title: "With trailing icon",
    description: "An icon follows the label, useful for calls-to-action.",
    component: WithTrailingIconVariant,
  },
  {
    title: "With dot",
    description: "A small colored dot communicates presence or availability.",
    component: WithDotVariant,
  },
  {
    title: "Colored",
    description: "Success, warning, and info tints via custom className.",
    component: ColoredVariant,
  },
  {
    title: "Number / count",
    description: "Rounded pill badges for notification counts and numbers.",
    component: NumberCountVariant,
  },
  {
    title: "Removable",
    description: "Each badge has an X button that removes it from the list.",
    component: RemovableVariant,
  },
  {
    title: "Soft / subtle",
    description: "Low-contrast tinted backgrounds for gentle emphasis.",
    component: SoftVariant,
  },
  {
    title: "Sizes",
    description: "Small, default, and large size variants side by side.",
    component: SizesVariant,
  },
]

export default function BadgePage() {
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
            <BreadcrumbPage>Badge</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Badge</h1>
        <p className="text-sm text-muted-foreground">
          Displays a label, status, or count. Browse our collection of{" "}
          {VARIANTS.length} Badge variants.
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
            <CardContent className="flex items-center justify-center py-6">
              <Component />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
