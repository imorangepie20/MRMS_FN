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
  BasicGroupedVariant,
  DialogVariant,
  SettingsGroupsVariant,
  KeyboardShortcutsVariant,
  WithIconsVariant,
  SearchWithTabsVariant,
  RecentVariant,
  EmptyStateVariant,
  UserListVariant,
} from "@/components/pages/components-command/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic grouped",
    description: "Inline command menu with grouped navigation, action, and file items.",
    component: BasicGroupedVariant,
  },
  {
    title: "Dialog (⌘K)",
    description: "A button that opens a command palette dialog; also triggered by ⌘K / Ctrl+K.",
    component: DialogVariant,
  },
  {
    title: "Settings groups",
    description: "Inline command with General, Notifications, Language, and Security groups.",
    component: SettingsGroupsVariant,
  },
  {
    title: "Keyboard shortcuts",
    description: "Command items each display a keyboard shortcut badge on the right.",
    component: KeyboardShortcutsVariant,
  },
  {
    title: "With icons",
    description: "Each command item has a leading icon alongside its label.",
    component: WithIconsVariant,
  },
  {
    title: "Search with tabs",
    description: "Filter tabs (All / Files / People / Commands) above the list narrow results.",
    component: SearchWithTabsVariant,
  },
  {
    title: "Recent",
    description: "A Recent group at the top followed by a Suggestions group.",
    component: RecentVariant,
  },
  {
    title: "Empty state",
    description: "Demonstrates the empty state when the search query matches no items.",
    component: EmptyStateVariant,
  },
  {
    title: "User list",
    description: "Searchable list of users with avatar initials, name, and location.",
    component: UserListVariant,
  },
]

export default function CommandPage() {
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
            <BreadcrumbPage>Command</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Command</h1>
        <p className="text-sm text-muted-foreground">
          Fast, composable, unstyled command menu for search and quick actions. Browse our
          collection of {VARIANTS.length} Command variants.
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
