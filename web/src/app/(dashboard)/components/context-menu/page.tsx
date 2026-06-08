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
import { CanonicalContextMenuVariant } from "@/components/pages/components-context-menu/variants"

export default function ContextMenuPage() {
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
            <BreadcrumbPage>Context Menu</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Context Menu</h1>
        <p className="text-sm text-muted-foreground">
          Displays a menu to the user — such as a set of actions or functions — triggered by a
          right click. Browse our collection of 1 Context Menu variant.
        </p>
      </div>

      {/* Single variant */}
      <div className="flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Canonical</CardTitle>
            <p className="text-sm text-muted-foreground">
              Right-click the dashed area to open a context menu with navigation, a submenu,
              checkbox items, and a radio group.
            </p>
          </CardHeader>
          <CardContent className="py-4">
            <CanonicalContextMenuVariant />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
