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
  DefaultVariant,
  OutlineVariant,
  MutedVariant,
  AlertVariant,
  AvatarVariant,
  ActionVariant,
  MediaVariant,
  UserListVariant,
  FeatureVariant,
} from "@/components/pages/components-item/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description: "A minimal item with title and description.",
    component: BasicVariant,
  },
  {
    title: "Default",
    description: "Transparent background, no visible border.",
    component: DefaultVariant,
  },
  {
    title: "Outline",
    description: "A bordered item with an outline style.",
    component: OutlineVariant,
  },
  {
    title: "Muted",
    description: "An item with a subtle muted background.",
    component: MutedVariant,
  },
  {
    title: "Alert",
    description:
      "An outline item with an icon media, title, description, and a Review action.",
    component: AlertVariant,
  },
  {
    title: "Avatar",
    description:
      "An item with an Avatar as media, user details, and a menu action.",
    component: AvatarVariant,
  },
  {
    title: "Action",
    description:
      "An empty-state item with a call-to-action Invite button.",
    component: ActionVariant,
  },
  {
    title: "Media",
    description:
      "An item with an image media slot, track title, and a navigation action.",
    component: MediaVariant,
  },
  {
    title: "User list",
    description:
      "An ItemGroup of three user rows separated by ItemSeparators.",
    component: UserListVariant,
  },
  {
    title: "Feature",
    description:
      "A fully-clickable feature card rendered as an anchor with asChild.",
    component: FeatureVariant,
  },
]

export default function ItemPage() {
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
            <BreadcrumbPage>Item</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Item</h1>
        <p className="text-sm text-muted-foreground">
          A flexible component for displaying content with media, title,
          description, and actions. Browse our collection of {VARIANTS.length}{" "}
          Item variants.
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
