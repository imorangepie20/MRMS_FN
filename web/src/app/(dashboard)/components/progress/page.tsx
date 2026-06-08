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
  WithLabelVariant,
  ColoredVariant,
  SystemMetricsVariant,
  SetupStepsVariant,
  MultiItemVariant,
  StorageUsageVariant,
  IndeterminateVariant,
  CircularVariant,
  InteractiveUploadVariant,
} from "@/components/pages/components-progress/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description: "A simple progress bar set to 60%.",
    component: BasicVariant,
  },
  {
    title: "With label",
    description: "A labeled progress bar showing upload status at 75%.",
    component: WithLabelVariant,
  },
  {
    title: "Colored",
    description: "Three bars with custom indicator colors: success, warning, and error.",
    component: ColoredVariant,
  },
  {
    title: "System metrics",
    description: "CPU, memory, and disk usage bars with icon labels.",
    component: SystemMetricsVariant,
  },
  {
    title: "Setup steps",
    description: "Segmented step indicator showing 2 of 4 steps completed.",
    component: SetupStepsVariant,
  },
  {
    title: "Multi-item",
    description: "Project status tracker with three labeled progress bars.",
    component: MultiItemVariant,
  },
  {
    title: "Storage usage",
    description: "Storage card showing 7.5 GB of 10 GB used with a badge.",
    component: StorageUsageVariant,
  },
  {
    title: "Indeterminate",
    description: "An animated bar for unknown-duration loading states.",
    component: IndeterminateVariant,
  },
  {
    title: "Circular",
    description: "A radial SVG progress circle showing 75% completion.",
    component: CircularVariant,
  },
  {
    title: "Interactive upload",
    description: "Click Upload to animate progress to 100% in fixed increments.",
    component: InteractiveUploadVariant,
  },
]

export default function ProgressPage() {
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
            <BreadcrumbPage>Progress</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="text-sm text-muted-foreground">
          Displays an indicator showing the completion progress of a task. Browse
          our collection of {VARIANTS.length} Progress variants.
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
