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
  WithClearButtonVariant,
  WithGroupsVariant,
  AsyncLoadingVariant,
  AutoHighlightVariant,
} from "@/components/pages/components-autocomplete/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description: "Type to filter the list; click or press Enter to select an item.",
    component: BasicVariant,
  },
  {
    title: "With clear button",
    description: "Same as Basic, with an X button inside the field to clear the current value.",
    component: WithClearButtonVariant,
  },
  {
    title: "With groups and labels",
    description: "Options are organized under labeled group headings in the dropdown.",
    component: WithGroupsVariant,
  },
  {
    title: "Async items loading",
    description: "Simulates an async fetch — shows a spinner while results load (600ms delay).",
    component: AsyncLoadingVariant,
  },
  {
    title: "Auto-highlight first option",
    description: "The first matching option is highlighted automatically; press Enter or arrows to navigate.",
    component: AutoHighlightVariant,
  },
]

export default function AutocompletePage() {
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
            <BreadcrumbPage>Autocomplete</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Autocomplete</h1>
        <p className="text-sm text-muted-foreground">
          A text field that allows users to select an option from a list. Browse our
          collection of {VARIANTS.length} Autocomplete variants.
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
