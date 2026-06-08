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
  ConfirmVariant,
  DeleteItemVariant,
  WithIconVariant,
  ScrollableNativeVariant,
  ScrollableCustomVariant,
  ScrollableStickyHeaderVariant,
  ScrollableStickyFooterVariant,
  TermsVariant,
  NewsletterVariant,
  FeedbackVariant,
  OtpVariant,
  SignInVariant,
  CheckoutVariant,
  ChangePlanVariant,
  EditProfileVariant,
  OnboardingVariant,
} from "@/components/pages/components-alert-dialog/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Confirm",
    description: "A standard confirmation dialog with cancel and continue actions.",
    component: ConfirmVariant,
  },
  {
    title: "Delete Item",
    description: "A destructive confirmation that warns before permanently deleting.",
    component: DeleteItemVariant,
  },
  {
    title: "Alert dialog with icon",
    description: "Draws attention with a warning icon and amber accent color.",
    component: WithIconVariant,
  },
  {
    title: "Scrollable (native scrollbar)",
    description: "Long content with the browser's native scrollbar.",
    component: ScrollableNativeVariant,
  },
  {
    title: "Scrollable (custom scrollbar)",
    description: "Long content inside a ScrollArea for a styled scrollbar.",
    component: ScrollableCustomVariant,
  },
  {
    title: "Scrollable (sticky header)",
    description: "The title stays fixed at the top while the body scrolls.",
    component: ScrollableStickyHeaderVariant,
  },
  {
    title: "Scrollable (sticky footer)",
    description: "The action buttons remain visible as the body scrolls.",
    component: ScrollableStickyFooterVariant,
  },
  {
    title: "Terms & Conditions",
    description: "Presents terms text with decline and agree actions.",
    component: TermsVariant,
  },
  {
    title: "Newsletter",
    description: "Collects an email address for newsletter subscription.",
    component: NewsletterVariant,
  },
  {
    title: "Feedback",
    description: "A textarea lets users submit freeform feedback.",
    component: FeedbackVariant,
  },
  {
    title: "OTP code",
    description: "Six single-character inputs for entering a verification code.",
    component: OtpVariant,
  },
  {
    title: "Sign in",
    description: "Email and password fields inside a modal sign-in flow.",
    component: SignInVariant,
  },
  {
    title: "Checkout",
    description: "Shows an order summary before the user confirms payment.",
    component: CheckoutVariant,
  },
  {
    title: "Change plan",
    description: "Radio-style plan selector for upgrading or downgrading.",
    component: ChangePlanVariant,
  },
  {
    title: "Edit profile",
    description: "Name and username inputs inside a quick profile editor.",
    component: EditProfileVariant,
  },
  {
    title: "Onboarding",
    description: "A welcome dialog that walks new users through setup steps.",
    component: OnboardingVariant,
  },
]

export default function AlertDialogPage() {
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
            <BreadcrumbPage>Alert Dialog</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Alert Dialog</h1>
        <p className="text-sm text-muted-foreground">
          A modal dialog that interrupts the user with important content and
          expects a response. Browse our collection of {VARIANTS.length} Alert
          Dialog variants.
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
