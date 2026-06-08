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
  WithIconsVariant,
  GroupedVariant,
  LabeledGroupsVariant,
  CheckboxItemsVariant,
  RadioItemsVariant,
  WithShortcutsVariant,
  WithSubmenuVariant,
  AccountMenuVariant,
  WithDisabledItemsVariant,
  RichMenuVariant,
  ScrollableVariant,
} from "@/components/pages/components-dropdown-menu/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description: "A simple dropdown menu with three navigation actions.",
    component: BasicVariant,
  },
  {
    title: "With icons",
    description: "Each menu item has a leading icon alongside its label.",
    component: WithIconsVariant,
  },
  {
    title: "Grouped",
    description: "Items organised into two groups separated by a divider.",
    component: GroupedVariant,
  },
  {
    title: "Labeled groups",
    description: "Named section labels above each group of related items.",
    component: LabeledGroupsVariant,
  },
  {
    title: "Checkbox items",
    description: "Toggle-able checkbox items for toggling UI panel visibility.",
    component: CheckboxItemsVariant,
  },
  {
    title: "Radio items",
    description: "Mutually exclusive radio items for selecting a panel position.",
    component: RadioItemsVariant,
  },
  {
    title: "With shortcuts",
    description: "Keyboard shortcut badges displayed on the right of each item.",
    component: WithShortcutsVariant,
  },
  {
    title: "With submenu",
    description: "An inline submenu triggered by hovering an Invite users item.",
    component: WithSubmenuVariant,
  },
  {
    title: "Account menu",
    description: "Full account dropdown triggered by an avatar button.",
    component: AccountMenuVariant,
  },
  {
    title: "With disabled items",
    description: "Some items are disabled and cannot be interacted with.",
    component: WithDisabledItemsVariant,
  },
  {
    title: "Rich menu",
    description: "Items with a title and small description for richer context.",
    component: RichMenuVariant,
  },
  {
    title: "Scrollable",
    description: "A long list of items rendered inside a scrollable container.",
    component: ScrollableVariant,
  },
]

export default function DropdownMenuPage() {
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
            <BreadcrumbPage>Dropdown Menu</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dropdown Menu</h1>
        <p className="text-sm text-muted-foreground">
          Displays a menu to the user — such as a set of actions or functions — triggered by a
          button. Browse our collection of {VARIANTS.length} Dropdown Menu variants.
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
            <CardContent className="flex items-center justify-center py-8">
              <Component />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
