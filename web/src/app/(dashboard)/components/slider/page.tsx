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
  WithValueLabelVariant,
  RangeVariant,
  StepsVariant,
  WithMarksVariant,
  VerticalVariant,
  DisabledVariant,
  ColoredVariant,
  WithInputVariant,
  VolumeVariant,
  PriceRangeVariant,
  SizesVariant,
  DataCapacityVariant,
} from "@/components/pages/components-slider/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description: "A single-thumb slider with a default value of 50.",
    component: BasicVariant,
  },
  {
    title: "With value label",
    description: "A slider that displays its current value, updating live as you drag.",
    component: WithValueLabelVariant,
  },
  {
    title: "Range",
    description: "A two-thumb range slider for selecting a min and max value.",
    component: RangeVariant,
  },
  {
    title: "Steps",
    description: "A slider that snaps to increments of 10 (0, 10, 20 … 100).",
    component: StepsVariant,
  },
  {
    title: "With marks",
    description: "A slider with labeled tick marks below at 0, 25, 50, 75, and 100.",
    component: WithMarksVariant,
  },
  {
    title: "Vertical",
    description: "A vertically oriented slider inside a fixed-height container.",
    component: VerticalVariant,
  },
  {
    title: "Disabled",
    description: "A slider in a disabled state that ignores user interaction.",
    component: DisabledVariant,
  },
  {
    title: "Colored",
    description: "A slider with a custom emerald accent on the filled range.",
    component: ColoredVariant,
  },
  {
    title: "With input",
    description: "A slider synced to a number input — changing either updates both.",
    component: WithInputVariant,
  },
  {
    title: "Volume",
    description: "A volume control with a dynamic icon that changes by level.",
    component: VolumeVariant,
  },
  {
    title: "Price range",
    description: "A two-thumb range slider over $0–$1,500 showing formatted price output.",
    component: PriceRangeVariant,
  },
  {
    title: "Sizes",
    description: "A thin (small track) and a default-sized slider stacked for comparison.",
    component: SizesVariant,
  },
  {
    title: "Data capacity",
    description: "A slider from 5–35 GB showing live storage output in gigabytes.",
    component: DataCapacityVariant,
  },
]

export default function SliderPage() {
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
            <BreadcrumbPage>Slider</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Slider</h1>
        <p className="text-sm text-muted-foreground">
          An input where the user selects a value from within a given range. Browse our
          collection of {VARIANTS.length} Slider variants.
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
