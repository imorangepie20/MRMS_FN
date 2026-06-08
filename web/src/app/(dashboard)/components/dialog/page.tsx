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
  EditProfileVariant,
  BasicVariant,
  ScrollableVariant,
  StickyHeaderVariant,
  StickyFooterVariant,
  ConfirmationVariant,
  SignInVariant,
  ShareVariant,
  SettingsTabsVariant,
  NewsletterVariant,
  FormVariant,
  SmallVariant,
  LargeVariant,
  FullScreenVariant,
  WithMediaVariant,
  NestedVariant,
} from "@/components/pages/components-dialog/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Edit profile",
    description: "The canonical dialog: name and username inputs with a save action.",
    component: EditProfileVariant,
  },
  {
    title: "Basic",
    description: "A simple dialog with a title, description, body text, and close button.",
    component: BasicVariant,
  },
  {
    title: "Scrollable",
    description: "Long terms content in a scrollable body with accept and decline actions.",
    component: ScrollableVariant,
  },
  {
    title: "Sticky header",
    description: "The title stays fixed at the top while the body scrolls.",
    component: StickyHeaderVariant,
  },
  {
    title: "Sticky footer",
    description: "The action buttons remain visible and pinned as the body scrolls.",
    component: StickyFooterVariant,
  },
  {
    title: "Confirmation",
    description: "A destructive confirmation that warns before permanently deleting.",
    component: ConfirmationVariant,
  },
  {
    title: "Sign in",
    description: "Email, password, and Google OAuth option inside a modal sign-in flow.",
    component: SignInVariant,
  },
  {
    title: "Share",
    description: "A read-only link with a copy button plus a list of people with access.",
    component: ShareVariant,
  },
  {
    title: "Settings (tabs)",
    description: "Account and notification settings organized into tab panels.",
    component: SettingsTabsVariant,
  },
  {
    title: "Newsletter",
    description: "Collects an email address for newsletter subscription.",
    component: NewsletterVariant,
  },
  {
    title: "Form",
    description: "A new project form with name, framework select, and description textarea.",
    component: FormVariant,
  },
  {
    title: "Small",
    description: "A compact dialog suitable for brief messages or quick confirmations.",
    component: SmallVariant,
  },
  {
    title: "Large",
    description: "A wide two-column dialog for content that needs more horizontal space.",
    component: LargeVariant,
  },
  {
    title: "Full screen",
    description: "A near-full-screen dialog with a sticky header and scrollable body.",
    component: FullScreenVariant,
  },
  {
    title: "With media",
    description: "A dialog with a gradient image area on top and a caption with actions.",
    component: WithMediaVariant,
  },
  {
    title: "Nested",
    description: "A dialog that opens a second nested dialog on top — both close correctly.",
    component: NestedVariant,
  },
]

export default function DialogPage() {
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
            <BreadcrumbPage>Dialog</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dialog</h1>
        <p className="text-sm text-muted-foreground">
          A window overlaid on either the primary window or another dialog window,
          rendering the content underneath inert. Browse our collection of{" "}
          {VARIANTS.length} Dialog variants.
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
