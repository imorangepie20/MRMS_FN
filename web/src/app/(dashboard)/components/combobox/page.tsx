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
  StatusVariant,
  MultiSelectVariant,
  GroupedVariant,
  WithIconsVariant,
  WithDescriptionsVariant,
  DisabledItemsVariant,
  ScrollableVariant,
  LoadingVariant,
  ClearButtonVariant,
  RecentVariant,
  WithButtonVariant,
} from "@/components/pages/components-combobox/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description: "Single-select combobox with search filtering and check indicator.",
    component: BasicVariant,
  },
  {
    title: "Status",
    description: "Status picker with icons for each state (Backlog, Todo, In Progress, etc.).",
    component: StatusVariant,
  },
  {
    title: "Multi-select",
    description: "Select multiple items; trigger shows badges or a count; popover stays open.",
    component: MultiSelectVariant,
  },
  {
    title: "Grouped",
    description: "Options organized into labeled CommandGroups with a separator between them.",
    component: GroupedVariant,
  },
  {
    title: "With icons",
    description: "Each option has a leading icon alongside its label.",
    component: WithIconsVariant,
  },
  {
    title: "With descriptions",
    description: "Each option displays a name and a muted description line below it.",
    component: WithDescriptionsVariant,
  },
  {
    title: "Disabled items",
    description: "Some command items are disabled — non-selectable and visually dimmed.",
    component: DisabledItemsVariant,
  },
  {
    title: "Scrollable",
    description: "A long list (~25 timezones) inside a scrollable CommandList.",
    component: ScrollableVariant,
  },
  {
    title: "Loading",
    description: "Shows a spinner for ~600 ms on open before revealing the options.",
    component: LoadingVariant,
  },
  {
    title: "Clear button",
    description: "An X button appears next to the trigger to clear the current selection.",
    component: ClearButtonVariant,
  },
  {
    title: "Recent",
    description: "A 'Recent' group at the top followed by an 'All' group below.",
    component: RecentVariant,
  },
  {
    title: "With button",
    description: "Combobox paired with an action button to assign and add the selection.",
    component: WithButtonVariant,
  },
]

export default function ComboboxPage() {
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
            <BreadcrumbPage>Combobox</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Combobox</h1>
        <p className="text-sm text-muted-foreground">
          Autocomplete input and command palette with a list of suggestions. Browse our collection
          of {VARIANTS.length} Combobox variants.
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
