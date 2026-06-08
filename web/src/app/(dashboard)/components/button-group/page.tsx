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
  ThreeActionsVariant,
  SegmentedSingleVariant,
  SegmentedMultiVariant,
  VerticalVariant,
  IconOnlyVariant,
  WithSeparatorVariant,
  SizesVariant,
  OutlineVariant,
  NumberedPaginationVariant,
  SplitDropdownVariant,
  MixedVariant,
  AttachedInputButtonVariant,
  InputWithPrefixVariant,
  InputSelectButtonVariant,
  ToolbarVariant,
  PillVariant,
  WithBadgeVariant,
  FullWidthVariant,
  NestedVariant,
} from "@/components/pages/components-button-group/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description: "Two joined buttons — Save and Exit.",
    component: BasicVariant,
  },
  {
    title: "Three actions",
    description: "Cut, Copy, and Paste grouped together.",
    component: ThreeActionsVariant,
  },
  {
    title: "Segmented (single)",
    description: "Click a segment to switch the active selection. One active at a time.",
    component: SegmentedSingleVariant,
  },
  {
    title: "Segmented (multi)",
    description: "Bold, Italic, Underline — multiple segments can be active simultaneously.",
    component: SegmentedMultiVariant,
  },
  {
    title: "Vertical",
    description: "A vertically stacked button group.",
    component: VerticalVariant,
  },
  {
    title: "Icon only",
    description: "Icon-only buttons for text alignment, grouped.",
    component: IconOnlyVariant,
  },
  {
    title: "With separator",
    description: "A visual separator divides two sub-groups within one group.",
    component: WithSeparatorVariant,
  },
  {
    title: "Sizes",
    description: "Small and large size groups side by side.",
    component: SizesVariant,
  },
  {
    title: "Outline",
    description: "Grouped outline-style buttons.",
    component: OutlineVariant,
  },
  {
    title: "Numbered pagination",
    description: "Page number buttons grouped, one active page highlighted.",
    component: NumberedPaginationVariant,
  },
  {
    title: "Split dropdown",
    description: "Primary action button joined with a chevron dropdown trigger.",
    component: SplitDropdownVariant,
  },
  {
    title: "Mixed",
    description: "A primary default button alongside outline buttons in one group.",
    component: MixedVariant,
  },
  {
    title: "Attached input + button",
    description: "An email input attached to a Subscribe button.",
    component: AttachedInputButtonVariant,
  },
  {
    title: "Input with prefix",
    description: "A ButtonGroupText prefix joined with an input field.",
    component: InputWithPrefixVariant,
  },
  {
    title: "Input + select + button",
    description: "Amount input, currency select, and Send button — all joined.",
    component: InputSelectButtonVariant,
  },
  {
    title: "Toolbar",
    description: "Multiple button groups forming a rich-text formatting toolbar.",
    component: ToolbarVariant,
  },
  {
    title: "Pill / rounded",
    description: "Fully rounded pill-shaped segmented control.",
    component: PillVariant,
  },
  {
    title: "With badge",
    description: "A button inside the group displays a notification count badge.",
    component: WithBadgeVariant,
  },
  {
    title: "Full width",
    description: "A button group stretched to fill its container width.",
    component: FullWidthVariant,
  },
  {
    title: "Nested",
    description: "A group containing navigation buttons wrapping a nested sub-group.",
    component: NestedVariant,
  },
]

export default function ButtonGroupPage() {
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
            <BreadcrumbPage>Button Group</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Button Group</h1>
        <p className="text-sm text-muted-foreground">
          Groups related buttons together with consistent styling. Browse our
          collection of {VARIANTS.length} Button Group variants.
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
