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
  NoProjectsVariant,
  WithAvatarsVariant,
  NoResultsSearchVariant,
  WithOutlineVariant,
  CloudStorageVariant,
  NotFoundVariant,
  MaintenanceVariant,
  NoConnectionVariant,
} from "@/components/pages/components-empty/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "No projects",
    description: "An empty state for when no projects have been created yet.",
    component: NoProjectsVariant,
  },
  {
    title: "With avatars",
    description: "An empty state with an avatar group stack inviting team collaboration.",
    component: WithAvatarsVariant,
  },
  {
    title: "No results (search)",
    description: "An empty search result state with a clear-search interaction.",
    component: NoResultsSearchVariant,
  },
  {
    title: "With outline",
    description: "An outlined dashed-border illustration style for file storage.",
    component: WithOutlineVariant,
  },
  {
    title: "Cloud storage",
    description: "A cloud storage empty state prompting the user to upload their first file.",
    component: CloudStorageVariant,
  },
  {
    title: "404 — Not Found",
    description: "A 404 page-not-found empty state with navigation actions.",
    component: NotFoundVariant,
  },
  {
    title: "Maintenance",
    description: "An under-maintenance empty state for scheduled downtime.",
    component: MaintenanceVariant,
  },
  {
    title: "No connection (offline)",
    description: "An offline empty state prompting the user to check their connection.",
    component: NoConnectionVariant,
  },
]

export default function EmptyPage() {
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
            <BreadcrumbPage>Empty</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Empty</h1>
        <p className="text-sm text-muted-foreground">
          An empty state component for when there&apos;s no data to display. Browse our
          collection of {VARIANTS.length} Empty variants.
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
