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
  DimensionsVariant,
  WithContentVariant,
  PositioningVariant,
  WithFormVariant,
  ProfileVariant,
  OnboardingStepsVariant,
} from "@/components/pages/components-popover/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Dimensions",
    description:
      "The canonical example: a form popover for setting layer width, max-width, height, and max-height.",
    component: DimensionsVariant,
  },
  {
    title: "With content",
    description:
      "A simple informational popover with a title, descriptive text, and a learn-more link.",
    component: WithContentVariant,
  },
  {
    title: "Positioning",
    description:
      "Four triggers demonstrating the popover anchored to each side: Top, Right, Bottom, Left.",
    component: PositioningVariant,
  },
  {
    title: "With form",
    description:
      "An 'Add note' trigger opening a form popover with Title + Note inputs; Save closes it.",
    component: WithFormVariant,
  },
  {
    title: "Profile",
    description:
      "A username trigger that reveals a profile card with avatar, bio, and a Follow button.",
    component: ProfileVariant,
  },
  {
    title: "Onboarding steps",
    description:
      "A product-tour popover showing step progress with Skip and Next navigation.",
    component: OnboardingStepsVariant,
  },
]

export default function PopoverPage() {
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
            <BreadcrumbPage>Popover</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Popover</h1>
        <p className="text-sm text-muted-foreground">
          Displays rich content in a portal, triggered by a button. Browse our
          collection of {VARIANTS.length} Popover variants.
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {VARIANTS.map(({ title, description, component: Component }) => (
          <Card key={title} className="min-h-64">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-8">
              <Component />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
