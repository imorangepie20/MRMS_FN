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
  HorizontalVariant,
  VerticalVariant,
  WithLabelOrVariant,
  WithTextLeftVariant,
  WithIconVariant,
  DashedVariant,
  DottedVariant,
  GradientHorizontalVariant,
  GradientVerticalVariant,
  ThickVariant,
  ColoredVariant,
  InsetVariant,
  InListVariant,
  DoubleLineVariant,
  VerticalIconToolbarVariant,
  SectionDividerVariant,
} from "@/components/pages/components-separator/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Horizontal",
    description:
      "The canonical shadcn example: a section header and a row of links separated by vertical separators.",
    component: HorizontalVariant,
  },
  {
    title: "Vertical",
    description:
      "Three inline items separated by a vertical separator in an inline row.",
    component: VerticalVariant,
  },
  {
    title: "With label (OR)",
    description:
      "A horizontal line with a centered \"OR\" label — common between login options.",
    component: WithLabelOrVariant,
  },
  {
    title: "With text (left)",
    description:
      "A section label on the left with a separator line extending to the right.",
    component: WithTextLeftVariant,
  },
  {
    title: "With icon",
    description:
      "A centered icon between two separator lines for decorative dividers.",
    component: WithIconVariant,
  },
  {
    title: "Dashed",
    description:
      "A dashed horizontal divider rendered with a CSS border.",
    component: DashedVariant,
  },
  {
    title: "Dotted",
    description:
      "A dotted horizontal divider rendered with a CSS border.",
    component: DottedVariant,
  },
  {
    title: "Gradient (horizontal)",
    description:
      "A horizontal line that fades to transparent at both edges.",
    component: GradientHorizontalVariant,
  },
  {
    title: "Gradient (vertical)",
    description:
      "A vertical line that fades to transparent at top and bottom.",
    component: GradientVerticalVariant,
  },
  {
    title: "Thick",
    description:
      "A thicker rounded separator for heavier visual separation.",
    component: ThickVariant,
  },
  {
    title: "Colored",
    description:
      "A separator using the primary brand color instead of the default border.",
    component: ColoredVariant,
  },
  {
    title: "Inset",
    description:
      "A separator with horizontal margins to leave gutters on both sides.",
    component: InsetVariant,
  },
  {
    title: "In a list",
    description:
      "A vertical list of items with a separator between each row.",
    component: InListVariant,
  },
  {
    title: "Double line",
    description:
      "Two stacked thin separators with a small gap for decorative emphasis.",
    component: DoubleLineVariant,
  },
  {
    title: "Vertical icon (toolbar)",
    description:
      "A toolbar row with icon buttons and a vertical separator dividing groups.",
    component: VerticalIconToolbarVariant,
  },
  {
    title: "Section divider",
    description:
      "A centered badge pill overlaid on a separator line to mark new sections.",
    component: SectionDividerVariant,
  },
]

export default function SeparatorPage() {
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
            <BreadcrumbPage>Separator</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Separator</h1>
        <p className="text-sm text-muted-foreground">
          Visually or semantically separates content. Browse our collection of{" "}
          {VARIANTS.length} Separator variants.
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
              <div className="w-full">
                <Component />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
