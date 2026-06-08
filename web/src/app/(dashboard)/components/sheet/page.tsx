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
  RightDefaultVariant,
  LeftNavigationVariant,
  TopVariant,
  BottomVariant,
  ScrollableVariant,
  FormSettingsVariant,
  EditProfileVariant,
  UserProfileVariant,
} from "@/components/pages/components-sheet/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Right (default)",
    description:
      "The canonical sheet: slides in from the right with name and username inputs.",
    component: RightDefaultVariant,
  },
  {
    title: "Left (navigation)",
    description:
      "A navigation drawer that slides in from the left with nav links and log out.",
    component: LeftNavigationVariant,
  },
  {
    title: "Top",
    description:
      "An announcement banner that slides down from the top of the screen.",
    component: TopVariant,
  },
  {
    title: "Bottom",
    description:
      "A quick-actions panel that slides up from the bottom of the screen.",
    component: BottomVariant,
  },
  {
    title: "Scrollable",
    description:
      "A right sheet whose body contains a large amount of scrollable content.",
    component: ScrollableVariant,
  },
  {
    title: "Form (settings)",
    description:
      "A settings sheet with toggle switches and a display-name input.",
    component: FormSettingsVariant,
  },
  {
    title: "Edit profile",
    description:
      "A right sheet with an avatar, name, email, and bio fields for editing.",
    component: EditProfileVariant,
  },
  {
    title: "User profile",
    description:
      "A read-only user info panel with avatar, stats, bio, and a follow button.",
    component: UserProfileVariant,
  },
]

export default function SheetPage() {
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
            <BreadcrumbPage>Sheet</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sheet</h1>
        <p className="text-sm text-muted-foreground">
          Extends the Dialog component to display content that complements the
          main content of the screen. Browse our collection of {VARIANTS.length}{" "}
          Sheet variants.
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
