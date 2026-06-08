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
  WithLabelVariant,
  LabelWithSublabelVariant,
  ColoredVariant,
  SizesVariant,
  SelectableCardVariant,
  SimpleTodoVariant,
  FancyTodoVariant,
  SelectAllPermsVariant,
  HierarchicalGroupVariant,
  SettingsListVariant,
  WithExpansionVariant,
  DisabledStatesVariant,
} from "@/components/pages/components-checkbox/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description: "Unchecked, checked, indeterminate, and disabled states side-by-side.",
    component: BasicVariant,
  },
  {
    title: "With label",
    description: "A checkbox paired with a label that toggles the checkbox on click.",
    component: WithLabelVariant,
  },
  {
    title: "Label with sublabel",
    description: "A checkbox with a primary label and a muted sub-description.",
    component: LabelWithSublabelVariant,
  },
  {
    title: "Colored",
    description: "Custom accent colors applied to checked checkboxes via className.",
    component: ColoredVariant,
  },
  {
    title: "Sizes",
    description: "Small, default, and large checkbox sizes in a single row.",
    component: SizesVariant,
  },
  {
    title: "Selectable card",
    description: "Bordered cards that toggle selection state when clicked.",
    component: SelectableCardVariant,
  },
  {
    title: "Simple todo",
    description: "A basic todo list that strikes through completed items.",
    component: SimpleTodoVariant,
  },
  {
    title: "Fancy todo",
    description: "Todo items with priority badges and strikethrough on completion.",
    component: FancyTodoVariant,
  },
  {
    title: "Select all",
    description: "Parent checkbox with indeterminate state controlling child checkboxes.",
    component: SelectAllPermsVariant,
  },
  {
    title: "Hierarchical group",
    description: "Nested checkbox group with all-platforms parent and individual controls.",
    component: HierarchicalGroupVariant,
  },
  {
    title: "Settings list",
    description: "A list of setting rows each with a checkbox, label, and description.",
    component: SettingsListVariant,
  },
  {
    title: "With expansion",
    description: "Checking a checkbox reveals a hidden block of additional content.",
    component: WithExpansionVariant,
  },
  {
    title: "Disabled states",
    description: "Disabled-unchecked and disabled-checked checkboxes with labels.",
    component: DisabledStatesVariant,
  },
]

export default function CheckboxPage() {
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
            <BreadcrumbPage>Checkbox</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Checkbox</h1>
        <p className="text-sm text-muted-foreground">
          A control that allows the user to toggle between checked and not checked. Browse our
          collection of {VARIANTS.length} Checkbox variants.
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
