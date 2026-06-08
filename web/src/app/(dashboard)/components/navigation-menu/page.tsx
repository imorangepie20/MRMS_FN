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
  WithIconsVariant,
  EcommerceVariant,
  SimpleLinksVariant,
} from "@/components/pages/components-navigation-menu/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Default",
    description:
      "The canonical shadcn example with Getting started, Components, and Docs navigation items.",
    component: DefaultVariant,
  },
  {
    title: "With icons",
    description:
      "Product navigation with icon-prefixed rows in the Product and Resources dropdowns.",
    component: WithIconsVariant,
  },
  {
    title: "E-commerce",
    description:
      "Storefront navigation with Collections and Accessories dropdowns plus plain Women and Men links.",
    component: EcommerceVariant,
  },
  {
    title: "Simple links",
    description:
      "Flat navigation bar of plain links: Home, About, Services, and Contact — no dropdowns.",
    component: SimpleLinksVariant,
  },
]

export default function NavigationMenuPage() {
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
            <BreadcrumbPage>Navigation Menu</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Navigation Menu</h1>
        <p className="text-sm text-muted-foreground">
          A collection of links for navigating websites. Browse our collection of{" "}
          {VARIANTS.length} Navigation Menu variants.
        </p>
      </div>

      {/* Variant sections — vertical stack so dropdown popups have room */}
      <div className="flex flex-col gap-8">
        {VARIANTS.map(({ title, description, component: Component }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardHeader>
            {/* min-h gives the dropdown popup vertical room to render without clipping */}
            <CardContent className="min-h-[20rem] py-6">
              <Component />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
