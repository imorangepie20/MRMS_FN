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
  BasicBottomVariant,
  TopVariant,
  ScrollableVariant,
  CookieSettingsVariant,
  LoginVariant,
  AddTaskVariant,
} from "@/components/pages/components-drawer/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic (bottom)",
    description: "A bottom drawer with a stepper to set your daily activity goal.",
    component: BasicBottomVariant,
  },
  {
    title: "Top",
    description: "A drawer that slides in from the top of the screen for notifications.",
    component: TopVariant,
  },
  {
    title: "Scrollable",
    description: "A bottom drawer with a long scrollable body and a close action.",
    component: ScrollableVariant,
  },
  {
    title: "Cookie settings",
    description: "Manage cookie preferences with toggles for each category.",
    component: CookieSettingsVariant,
  },
  {
    title: "Login",
    description: "A bottom drawer with an email and password sign-in form.",
    component: LoginVariant,
  },
  {
    title: "Add Task",
    description: "A task creation form with title, priority select, and notes.",
    component: AddTaskVariant,
  },
]

export default function DrawerPage() {
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
            <BreadcrumbPage>Drawer</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Drawer</h1>
        <p className="text-sm text-muted-foreground">
          A drawer is a panel that slides in from the edge of the screen. Browse our
          collection of {VARIANTS.length} Drawer variants.
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
            <CardContent className="flex items-center justify-center py-6">
              <Component />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
