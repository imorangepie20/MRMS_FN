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
  BasicVariant,
  PlusIconVariant,
  IconOnLeftVariant,
  WithSubtextVariant,
  WithSubtextAndIconVariant,
  StackedVariant,
  StackedLeftIconVariant,
  ActiveStateVariant,
  BorderedVariant,
  MultipleVariant,
  DisabledItemVariant,
  GhostFilledVariant,
} from "@/components/pages/components-accordion/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description: "A single-expand accordion with chevron toggle on the right.",
    component: BasicVariant,
  },
  {
    title: "Plus icon",
    description: "The chevron is replaced with a Plus that becomes a Minus when open.",
    component: PlusIconVariant,
  },
  {
    title: "Icon on the left",
    description: "The toggle icon is placed before the question text.",
    component: IconOnLeftVariant,
  },
  {
    title: "With subtext",
    description: "A muted subtitle line appears beneath each question.",
    component: WithSubtextVariant,
  },
  {
    title: "With subtext + icon",
    description: "Left-side chevron combined with question and subtitle.",
    component: WithSubtextAndIconVariant,
  },
  {
    title: "Stacked",
    description: "Each item is a separate bordered card with a gap between them.",
    component: StackedVariant,
  },
  {
    title: "Stacked + left icon",
    description: "Stacked cards with the toggle chevron on the left.",
    component: StackedLeftIconVariant,
  },
  {
    title: "Active state",
    description: "The first item is expanded by default via defaultValue.",
    component: ActiveStateVariant,
  },
  {
    title: "Bordered",
    description: "Each item is wrapped in a rounded border.",
    component: BorderedVariant,
  },
  {
    title: "Multiple",
    description: "Multiple items can be open simultaneously.",
    component: MultipleVariant,
  },
  {
    title: "Disabled item",
    description: "One item is disabled and cannot be expanded.",
    component: DisabledItemVariant,
  },
  {
    title: "Ghost / filled",
    description: "Items have a soft filled background for a ghost-card feel.",
    component: GhostFilledVariant,
  },
]

export default function AccordionPage() {
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
            <BreadcrumbPage>Accordion</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Accordion</h1>
        <p className="text-sm text-muted-foreground">
          A vertically stacked set of interactive headings that each reveal a
          section of content. Browse our collection of {VARIANTS.length} Accordion
          variants.
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
