import * as React from "react"
import Link from "next/link"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage as BreadcrumbPageItem,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DefaultVariant,
  WithIconsVariant,
  SlashSeparatorVariant,
  DotSeparatorVariant,
  WithDropdownVariant,
  WithEllipsisVariant,
} from "@/components/pages/components-breadcrumb/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Default",
    description: "Standard chevron separator with linked breadcrumb items.",
    component: DefaultVariant,
  },
  {
    title: "With icons",
    description: "The Home item includes a house icon alongside its label.",
    component: WithIconsVariant,
  },
  {
    title: "Slash separator",
    description: "Uses a slash icon as the separator between breadcrumb items.",
    component: SlashSeparatorVariant,
  },
  {
    title: "Dot separator",
    description: "Uses a middle dot character as the separator between items.",
    component: DotSeparatorVariant,
  },
  {
    title: "With dropdown",
    description: "Collapsed middle items revealed via a dropdown menu trigger.",
    component: WithDropdownVariant,
  },
  {
    title: "With ellipsis",
    description: "A non-interactive ellipsis indicator replaces middle items.",
    component: WithEllipsisVariant,
  },
]

export default function BreadcrumbPage() {
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
            <BreadcrumbPageItem>Breadcrumb</BreadcrumbPageItem>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Breadcrumb</h1>
        <p className="text-sm text-muted-foreground">
          Displays the path to the current resource using a hierarchy of links.
          Browse our collection of {VARIANTS.length} Breadcrumb variants.
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
            <CardContent className="flex items-center justify-center py-6">
              <Component />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
