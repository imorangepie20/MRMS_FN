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
  WithIconVariant,
  WithHelperTextVariant,
  ErrorStateVariant,
  OptionGroupsVariant,
  StatusVariant,
  ItemsWithIconsVariant,
  ItemsWithDescriptionVariant,
  WithAvatarVariant,
  ScrollableVariant,
  WithSearchVariant,
  DisabledSelectVariant,
  DisabledOptionsVariant,
  SizesVariant,
} from "@/components/pages/components-select/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Default",
    description: "Basic fruit select with a placeholder and value binding.",
    component: DefaultVariant,
  },
  {
    title: "With label",
    description: "A visible label sits above the select for clarity.",
    component: WithLabelVariant,
  },
  {
    title: "With icon",
    description: "A leading icon inside the trigger alongside the value.",
    component: WithIconVariant,
  },
  {
    title: "With helper text",
    description: "Muted helper text below the select gives additional context.",
    component: WithHelperTextVariant,
  },
  {
    title: "Error state",
    description: "Destructive ring and error message indicate a validation failure.",
    component: ErrorStateVariant,
  },
  {
    title: "Option groups",
    description: "Options organized into labeled groups with a separator.",
    component: OptionGroupsVariant,
  },
  {
    title: "Status",
    description: "Each option features a colored dot indicating availability status.",
    component: StatusVariant,
  },
  {
    title: "Items with icons",
    description: "Each item displays a leading icon alongside its label.",
    component: ItemsWithIconsVariant,
  },
  {
    title: "Items with description",
    description: "Each item shows a name and a muted description below it.",
    component: ItemsWithDescriptionVariant,
  },
  {
    title: "With avatar",
    description: "An assignee picker where each item shows an avatar with initials.",
    component: WithAvatarVariant,
  },
  {
    title: "Scrollable",
    description: "A long list of timezones inside a scrollable dropdown.",
    component: ScrollableVariant,
  },
  {
    title: "With search",
    description: "A sticky search input at the top filters the option list in real time.",
    component: WithSearchVariant,
  },
  {
    title: "Disabled select",
    description: "The entire select is disabled — trigger is non-interactive.",
    component: DisabledSelectVariant,
  },
  {
    title: "Disabled options",
    description: "Two options are individually disabled while the rest remain selectable.",
    component: DisabledOptionsVariant,
  },
  {
    title: "Sizes",
    description: "Small (sm) and default size variants stacked for comparison.",
    component: SizesVariant,
  },
]

export default function SelectPage() {
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
            <BreadcrumbPage>Select</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Select</h1>
        <p className="text-sm text-muted-foreground">
          Displays a list of options for the user to pick from, triggered by a button. Browse our
          collection of {VARIANTS.length} Select variants.
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
