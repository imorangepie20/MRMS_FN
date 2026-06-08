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
  SuccessVariant,
  ErrorVariant,
  WarningVariant,
  InfoVariant,
  WithDescriptionVariant,
  WithActionVariant,
  WithCancelVariant,
  PromiseVariant,
  LoadingVariant,
  CustomJsxVariant,
  RichWithIconVariant,
} from "@/components/pages/components-sonner-toast/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Default",
    description: "A basic toast notification with a short message.",
    component: DefaultVariant,
  },
  {
    title: "Success",
    description: "A success toast confirming a completed action.",
    component: SuccessVariant,
  },
  {
    title: "Error",
    description: "An error toast indicating something went wrong.",
    component: ErrorVariant,
  },
  {
    title: "Warning",
    description: "A warning toast alerting the user to a potentially risky action.",
    component: WarningVariant,
  },
  {
    title: "Info",
    description: "An informational toast surfacing a helpful update.",
    component: InfoVariant,
  },
  {
    title: "With description",
    description: "A toast with a title and a supporting description line.",
    component: WithDescriptionVariant,
  },
  {
    title: "With action",
    description: "A toast with an action button (e.g. Undo) the user can tap.",
    component: WithActionVariant,
  },
  {
    title: "With cancel",
    description: "A toast with a cancel button to abort an in-flight operation.",
    component: WithCancelVariant,
  },
  {
    title: "Promise",
    description: "Tracks a promise through loading → success (or error) states.",
    component: PromiseVariant,
  },
  {
    title: "Loading",
    description: "A persistent loading toast while an async operation is running.",
    component: LoadingVariant,
  },
  {
    title: "Custom (JSX)",
    description: "A fully custom JSX toast with your own layout and dismiss logic.",
    component: CustomJsxVariant,
  },
  {
    title: "Rich / with icon",
    description: "A toast with a custom icon passed via the icon option.",
    component: RichWithIconVariant,
  },
]

export default function SonnerToastPage() {
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
            <BreadcrumbPage>Sonner Toast</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sonner Toast</h1>
        <p className="text-sm text-muted-foreground">
          An opinionated toast component for React. Browse our collection of{" "}
          {VARIANTS.length} Sonner Toast variants.
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
