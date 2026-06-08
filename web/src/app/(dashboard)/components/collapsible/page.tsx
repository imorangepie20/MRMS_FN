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
  BasicToggleVariant,
  WithChevronVariant,
  ShowMoreVariant,
  WithCardVariant,
  WithCommentsVariant,
  FaqItemVariant,
  NestedVariant,
  SidebarGroupVariant,
} from "@/components/pages/components-collapsible/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic toggle",
    description: "The canonical collapsible: a trigger button that shows or hides additional repository rows.",
    component: BasicToggleVariant,
  },
  {
    title: "With chevron",
    description: "A trigger row with a ChevronDown that rotates 180° when the panel is open.",
    component: WithChevronVariant,
  },
  {
    title: "Show more / less",
    description: "A paragraph with a Show more / Show less button that reveals or hides additional text.",
    component: ShowMoreVariant,
  },
  {
    title: "With card",
    description: "A Card with a Notifications header and a collapsible Advanced settings section.",
    component: WithCardVariant,
  },
  {
    title: "With form / comments",
    description: "A comment thread with a collapsible replies section and a reply input.",
    component: WithCommentsVariant,
  },
  {
    title: "FAQ item",
    description: "A single bordered FAQ row that expands to reveal the answer with a chevron indicator.",
    component: FaqItemVariant,
  },
  {
    title: "Nested",
    description: "A collapsible Project that reveals a nested collapsible src folder and file rows.",
    component: NestedVariant,
  },
  {
    title: "Sidebar group",
    description: "A collapsible nav group: a Settings trigger that expands to show sub-item rows.",
    component: SidebarGroupVariant,
  },
]

export default function CollapsiblePage() {
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
            <BreadcrumbPage>Collapsible</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Collapsible</h1>
        <p className="text-sm text-muted-foreground">
          An interactive component which expands/collapses a panel. Browse our
          collection of {VARIANTS.length} Collapsible variants.
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2">
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
