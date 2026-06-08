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
  UserProfileVariant,
  StatsActionsVariant,
} from "@/components/pages/components-hover-card/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description:
      "The canonical hover card showing a social-profile popup triggered by a link.",
    component: BasicVariant,
  },
  {
    title: "User profile",
    description:
      "A username trigger that reveals a profile card with bio and follower counts.",
    component: UserProfileVariant,
  },
  {
    title: "Stats and actions",
    description:
      "A trigger that opens a card with post/follower stats and Follow / View Profile actions.",
    component: StatsActionsVariant,
  },
]

export default function HoverCardPage() {
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
            <BreadcrumbPage>Hover Card</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Hover Card</h1>
        <p className="text-sm text-muted-foreground">
          For sighted users to preview content available behind a link. Browse
          our collection of {VARIANTS.length} Hover Card variants.
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {VARIANTS.map(({ title, description, component: Component }) => (
          <Card key={title} className="min-h-64">
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 py-4">
              <Component />
              <p className="text-xs text-muted-foreground">
                Hover the trigger to preview
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
