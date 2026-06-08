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
import { CanonicalMenubarVariant } from "@/components/pages/components-menubar/variants"

export default function MenubarPage() {
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
            <BreadcrumbPage>Menubar</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Menubar</h1>
        <p className="text-sm text-muted-foreground">
          A visually persistent menu common in desktop applications that provides quick access to a
          consistent set of commands. Browse our collection of 1 Menubar variant.
        </p>
      </div>

      {/* Single variant */}
      <div className="flex justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Canonical</CardTitle>
            <p className="text-sm text-muted-foreground">
              A desktop-style menubar with File, Edit, View, and Profiles menus including submenus,
              checkbox items, and a radio group.
            </p>
          </CardHeader>
          <CardContent className="py-4">
            <CanonicalMenubarVariant />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
