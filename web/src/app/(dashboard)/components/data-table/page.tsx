import Link from "next/link"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  BasicSelectionVariant,
  ExpandableRowsVariant,
  VerticalScrollVariant,
  DraggableRowsVariant,
  DraggableColumnsVariant,
  ActionButtonsVariant,
} from "@/components/pages/components-data-table/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic with selection",
    description:
      "Checkbox selection on every row with select-all in the header, sortable Email column, and Previous/Next pagination.",
    component: BasicSelectionVariant,
  },
  {
    title: "Expandable rows",
    description:
      "Click the chevron on any row to expand an inline detail panel showing shipping address and items.",
    component: ExpandableRowsVariant,
  },
  {
    title: "Vertical scroll",
    description:
      "Ten rows in a fixed-height container with a sticky header and a scrollable body.",
    component: VerticalScrollVariant,
  },
  {
    title: "Draggable rows",
    description:
      "Grab the handle on any row and drag to reorder using @dnd-kit sortable.",
    component: DraggableRowsVariant,
  },
  {
    title: "Draggable columns",
    description:
      "Drag column headers to reorder columns — uses @dnd-kit horizontal sortable to update TanStack columnOrder state.",
    component: DraggableColumnsVariant,
  },
  {
    title: "With action buttons",
    description:
      "Each row has explicit Edit and Delete icon buttons plus a ⋯ dropdown. Deleting a row removes it from local state.",
    component: ActionButtonsVariant,
  },
]

export default function DataTablePage() {
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
            <BreadcrumbPage>Data Table</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Data Table</h1>
        <p className="text-sm text-muted-foreground">
          Powerful table and datagrids built using TanStack Table. Browse our collection of{" "}
          {VARIANTS.length} Data Table variants.
        </p>
      </div>

      {/* Variant sections */}
      <div className="flex flex-col gap-8">
        {VARIANTS.map(({ title, description, component: Component }) => (
          <section key={title} className="flex flex-col gap-3">
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <Component />
          </section>
        ))}
      </div>
    </div>
  )
}
