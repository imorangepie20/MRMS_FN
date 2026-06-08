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
  FullControlsVariant,
  CompactRowsVariant,
  SimpleVariant,
  ManyPagesEllipsisVariant,
  InteractiveVariant,
  OutlineVariant,
  RoundedPillVariant,
  IconOnlyNavVariant,
  PageJumpVariant,
  MinimalCounterVariant,
  ResultsSummaryVariant,
} from "@/components/pages/components-pagination/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description:
      "The canonical shadcn example: previous, page numbers, ellipsis, next.",
    component: BasicVariant,
  },
  {
    title: "Full controls",
    description:
      "First / prev / page numbers / next / last icon buttons with a page counter.",
    component: FullControlsVariant,
  },
  {
    title: "Compact + rows per page",
    description:
      "Data-table footer style: rows-per-page select, range text, prev/next buttons.",
    component: CompactRowsVariant,
  },
  {
    title: "Simple",
    description: "Minimal: just Previous and Next text links, centered.",
    component: SimpleVariant,
  },
  {
    title: "Many pages with ellipsis",
    description:
      "1 … 8 9 10 … 20 pattern — shows context around the active page.",
    component: ManyPagesEllipsisVariant,
  },
  {
    title: "Interactive",
    description:
      "Fully client-side paginator over 8 pages — click a number or prev/next to update state.",
    component: InteractiveVariant,
  },
  {
    title: "Outline",
    description: "Page buttons styled with an outline border for a subtle look.",
    component: OutlineVariant,
  },
  {
    title: "Rounded / pill",
    description: "Circular page buttons with rounded-full styling.",
    component: RoundedPillVariant,
  },
  {
    title: "Icon-only nav",
    description: "Chevron-only prev/next with numbered page links.",
    component: IconOnlyNavVariant,
  },
  {
    title: "Page jump",
    description: "Go-to-page input + Go button alongside prev/next controls.",
    component: PageJumpVariant,
  },
  {
    title: "Minimal counter",
    description: '"Page 3 of 12" text flanked by prev/next chevron buttons.',
    component: MinimalCounterVariant,
  },
  {
    title: "Results summary",
    description:
      '"Showing 1 to 10 of 97 results" on the left with page links on the right.',
    component: ResultsSummaryVariant,
  },
]

export default function PaginationPage() {
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
            <BreadcrumbPage>Pagination</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pagination</h1>
        <p className="text-sm text-muted-foreground">
          Pagination with page navigation, next and previous links. Browse our
          collection of {VARIANTS.length} Pagination variants.
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
