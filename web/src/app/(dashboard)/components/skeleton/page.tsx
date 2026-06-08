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
  TextLinesVariant,
  CardVariant,
  ListVariant,
  TableVariant,
  ProfileVariant,
  ImageGridVariant,
} from "@/components/pages/components-skeleton/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description: "The canonical avatar + two text line skeleton pattern.",
    component: BasicVariant,
  },
  {
    title: "Text lines",
    description: "A title skeleton followed by three paragraph line skeletons.",
    component: TextLinesVariant,
  },
  {
    title: "Card",
    description: "A media block, title, body lines, and footer button skeletons.",
    component: CardVariant,
  },
  {
    title: "List",
    description: "Five rows each with an avatar skeleton and two stacked line skeletons.",
    component: ListVariant,
  },
  {
    title: "Table",
    description: "A header row and five body rows of four cell skeletons each.",
    component: TableVariant,
  },
  {
    title: "Profile",
    description: "A cover, avatar, name/handle lines, and stats row skeletons.",
    component: ProfileVariant,
  },
  {
    title: "Image grid",
    description: "A 3-column grid of six square image placeholder skeletons.",
    component: ImageGridVariant,
  },
]

export default function SkeletonPage() {
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
            <BreadcrumbPage>Skeleton</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Skeleton</h1>
        <p className="text-sm text-muted-foreground">
          Use to show a placeholder while content is loading. Browse our collection of{" "}
          {VARIANTS.length} Skeleton variants.
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
