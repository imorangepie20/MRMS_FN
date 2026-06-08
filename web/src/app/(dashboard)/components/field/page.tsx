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
  PaymentMethodVariant,
  BillingAddressVariant,
  CommentsVariant,
  UsernameVariant,
  PasswordVariant,
  FeedbackVariant,
  DepartmentVariant,
  NotificationsVariant,
  AddressFieldsetVariant,
  SubscriptionVariant,
} from "@/components/pages/components-field/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Payment Method",
    description: "A card details fieldset with card number, expiration, and CVV inputs.",
    component: PaymentMethodVariant,
  },
  {
    title: "Billing Address",
    description: "An address field with a checkbox to copy the shipping address.",
    component: BillingAddressVariant,
  },
  {
    title: "Comments",
    description: "A comment textarea with description and Submit / Cancel actions.",
    component: CommentsVariant,
  },
  {
    title: "Username",
    description: "A username input with a helper description below.",
    component: UsernameVariant,
  },
  {
    title: "Password",
    description: "A password input with an inline validation error message.",
    component: PasswordVariant,
  },
  {
    title: "Feedback",
    description: "A larger feedback textarea with a description.",
    component: FeedbackVariant,
  },
  {
    title: "Department",
    description: "A select field for choosing a department with a description.",
    component: DepartmentVariant,
  },
  {
    title: "Notifications (switch)",
    description: "A horizontal field with a label on the left and a switch on the right.",
    component: NotificationsVariant,
  },
  {
    title: "Address (fieldset)",
    description: "A fieldset with street, city, postal code, and country fields.",
    component: AddressFieldsetVariant,
  },
  {
    title: "Subscription (radio)",
    description: "A radio group for choosing a subscription plan with pricing details.",
    component: SubscriptionVariant,
  },
]

export default function FieldPage() {
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
            <BreadcrumbPage>Field</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Field</h1>
        <p className="text-sm text-muted-foreground">
          A field is a form control with a label, description, and validation
          message. Browse our collection of {VARIANTS.length} Field variants.
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
