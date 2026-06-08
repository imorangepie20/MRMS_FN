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
  WithLabelVariant,
  WithHelperTextVariant,
  ErrorStateVariant,
  OptionGroupsVariant,
} from "@/components/pages/components-native-select/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Default",
    description: "A basic native select with status options.",
    component: DefaultVariant,
  },
  {
    title: "With label",
    description: "A native select paired with an accessible label.",
    component: WithLabelVariant,
  },
  {
    title: "With helper text",
    description: "A native select with a muted helper text description below.",
    component: WithHelperTextVariant,
  },
  {
    title: "Error state",
    description: "A native select in an error state with a destructive message.",
    component: ErrorStateVariant,
  },
  {
    title: "Option groups",
    description: "A native select with grouped options using optgroup.",
    component: OptionGroupsVariant,
  },
]

export default function NativeSelectPage() {
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
            <BreadcrumbPage>Native Select</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Native Select</h1>
        <p className="text-sm text-muted-foreground">
          A styled native select element with consistent styling and
          browser-native behavior. Browse our collection of 5 Native Select
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
