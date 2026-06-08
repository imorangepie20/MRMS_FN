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
  DefaultVariant,
  DestructiveVariant,
  SuccessVariant,
  WarningVariant,
  InfoVariant,
  DestructiveFilledVariant,
  SuccessFilledVariant,
  WarningFilledVariant,
  InfoLeftAccentVariant,
  ValidationErrorVariant,
  WithActionVariant,
  DismissibleVariant,
  WithLinkVariant,
  SimpleNoTitleVariant,
  OutlineVariant,
} from "@/components/pages/components-alert/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Default",
    description: "A standard informational alert with icon, title, and description.",
    component: DefaultVariant,
  },
  {
    title: "Destructive",
    description: "Signals an error or critical issue using the destructive color.",
    component: DestructiveVariant,
  },
  {
    title: "Success",
    description: "Confirms a completed action with an emerald success palette.",
    component: SuccessVariant,
  },
  {
    title: "Warning",
    description: "Draws attention to a potential issue with an amber palette.",
    component: WarningVariant,
  },
  {
    title: "Info",
    description: "A soft blue informational alert for neutral status updates.",
    component: InfoVariant,
  },
  {
    title: "Destructive (filled)",
    description: "Solid red background for high-urgency error messages.",
    component: DestructiveFilledVariant,
  },
  {
    title: "Success (filled)",
    description: "Solid emerald background for prominent success feedback.",
    component: SuccessFilledVariant,
  },
  {
    title: "Warning (filled)",
    description: "Solid amber background for highly visible warnings.",
    component: WarningFilledVariant,
  },
  {
    title: "Info (left accent)",
    description: "Thick left border accent creates a sidebar emphasis effect.",
    component: InfoLeftAccentVariant,
  },
  {
    title: "Validation error",
    description: "Displays a bulleted list of failed validation requirements.",
    component: ValidationErrorVariant,
  },
  {
    title: "With action",
    description: "Includes an inline action button positioned at the top right.",
    component: WithActionVariant,
  },
  {
    title: "Dismissible",
    description: "An X close button lets the user hide the alert from view.",
    component: DismissibleVariant,
  },
  {
    title: "With link",
    description: "The description contains an inline link for contextual navigation.",
    component: WithLinkVariant,
  },
  {
    title: "Simple (no title)",
    description: "Compact single-line alert with just an icon and description text.",
    component: SimpleNoTitleVariant,
  },
  {
    title: "Outline",
    description: "Plain bordered alert without a tinted background.",
    component: OutlineVariant,
  },
]

export default function AlertPage() {
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
            <BreadcrumbPage>Alert</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Alert</h1>
        <p className="text-sm text-muted-foreground">
          Displays a callout for user attention. Browse our collection of{" "}
          {VARIANTS.length} Alert variants.
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
