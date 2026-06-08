"use client"

import Link from "next/link"
import { BookOpen, Box, Layers, ShoppingBag, Sparkles, Circle } from "lucide-react"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"

// ─── Shared helper ────────────────────────────────────────────────────────────
function ListItem({
  title,
  children,
  href = "#",
  className,
}: {
  title: string
  children?: React.ReactNode
  href?: string
  className?: string
}) {
  return (
    <NavigationMenuLink
      render={<Link href={href} />}
      className={cn(
        "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors",
        className
      )}
    >
      <div className="text-sm font-medium leading-none">{title}</div>
      {children && (
        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
          {children}
        </p>
      )}
    </NavigationMenuLink>
  )
}

// ─── 1. Default ───────────────────────────────────────────────────────────────
export function DefaultVariant() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        {/* Getting started */}
        <NavigationMenuItem>
          <NavigationMenuTrigger>Getting started</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
              <li className="row-span-3">
                <NavigationMenuLink
                  render={<Link href="#" />}
                  className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                >
                  <Sparkles className="size-6" />
                  <div className="mb-2 mt-4 text-lg font-medium">shadcn/ui</div>
                  <p className="text-sm leading-tight text-muted-foreground">
                    Beautifully designed components built with Base UI and Tailwind CSS.
                  </p>
                </NavigationMenuLink>
              </li>
              <ListItem href="#" title="Introduction">
                Re-usable components built using Base UI and Tailwind CSS.
              </ListItem>
              <ListItem href="#" title="Installation">
                How to install dependencies and structure your app.
              </ListItem>
              <ListItem href="#" title="Typography">
                Styles for headings, paragraphs, lists and more.
              </ListItem>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Components */}
        <NavigationMenuItem>
          <NavigationMenuTrigger>Components</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
              {[
                { title: "Alert Dialog", description: "A modal dialog that interrupts the user." },
                { title: "Hover Card", description: "Preview content on hover without navigation." },
                { title: "Progress", description: "Displays an indicator showing task completion." },
                { title: "Scroll Area", description: "Visually or semantically separates content." },
                { title: "Tabs", description: "A set of layered sections—only one visible at a time." },
                { title: "Tooltip", description: "A popup that displays info when element is hovered." },
              ].map((item) => (
                <ListItem key={item.title} title={item.title} href="#">
                  {item.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Docs plain link */}
        <NavigationMenuItem>
          <NavigationMenuLink
            render={<Link href="#" />}
            className={navigationMenuTriggerStyle()}
          >
            Docs
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

// ─── 2. With icons (Product) ──────────────────────────────────────────────────
function IconListItem({
  icon: Icon,
  title,
  children,
  href = "#",
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  href?: string
}) {
  return (
    <NavigationMenuLink
      render={<Link href={href} />}
      className="flex select-none gap-3 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-muted focus:bg-muted"
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
        <Icon className="size-4" />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium leading-none">{title}</div>
        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
          {children}
        </p>
      </div>
    </NavigationMenuLink>
  )
}

export function WithIconsVariant() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        {/* Product */}
        <NavigationMenuItem>
          <NavigationMenuTrigger>Product</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[420px] gap-1 p-3 md:grid-cols-2">
              <IconListItem icon={Box} title="Components" href="#">
                Reusable UI building blocks for your design system.
              </IconListItem>
              <IconListItem icon={Layers} title="Templates" href="#">
                Pre-built page templates to get started quickly.
              </IconListItem>
              <IconListItem icon={Sparkles} title="AI Tools" href="#">
                Intelligent helpers to accelerate your workflow.
              </IconListItem>
              <IconListItem icon={Circle} title="Integrations" href="#">
                Connect with your favourite third-party services.
              </IconListItem>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Resources */}
        <NavigationMenuItem>
          <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[340px] gap-1 p-3">
              <IconListItem icon={BookOpen} title="Documentation" href="#">
                Comprehensive guides and API references.
              </IconListItem>
              <IconListItem icon={ShoppingBag} title="Marketplace" href="#">
                Discover and download community components.
              </IconListItem>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Plain links */}
        <NavigationMenuItem>
          <NavigationMenuLink
            render={<Link href="#" />}
            className={navigationMenuTriggerStyle()}
          >
            Pricing
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink
            render={<Link href="#" />}
            className={navigationMenuTriggerStyle()}
          >
            Company
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

// ─── 3. E-commerce ────────────────────────────────────────────────────────────
export function EcommerceVariant() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        {/* Collections */}
        <NavigationMenuItem>
          <NavigationMenuTrigger>Collections</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[380px] gap-1 p-3 md:grid-cols-2">
              {[
                { title: "New Arrivals", description: "Fresh styles added this week." },
                { title: "Best Sellers", description: "Top picks loved by our community." },
                { title: "Sale", description: "Up to 50% off selected items." },
                { title: "Limited Edition", description: "Exclusive drops, while stocks last." },
              ].map((item) => (
                <ListItem key={item.title} href="#" title={item.title}>
                  {item.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Accessories */}
        <NavigationMenuItem>
          <NavigationMenuTrigger>Accessories</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[300px] gap-1 p-3 md:grid-cols-2">
              {[
                { title: "Bags", description: "Totes, backpacks and clutches." },
                { title: "Jewellery", description: "Rings, necklaces and earrings." },
                { title: "Hats", description: "Caps, beanies and bucket hats." },
                { title: "Scarves", description: "Silk, wool and cotton options." },
              ].map((item) => (
                <ListItem key={item.title} href="#" title={item.title}>
                  {item.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Plain links */}
        <NavigationMenuItem>
          <NavigationMenuLink
            render={<Link href="#" />}
            className={navigationMenuTriggerStyle()}
          >
            Women
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink
            render={<Link href="#" />}
            className={navigationMenuTriggerStyle()}
          >
            Men
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

// ─── 4. Simple links ──────────────────────────────────────────────────────────
export function SimpleLinksVariant() {
  const links = [
    { label: "Home", href: "#" },
    { label: "About", href: "#" },
    { label: "Services", href: "#" },
    { label: "Contact", href: "#" },
  ]

  return (
    <NavigationMenu>
      <NavigationMenuList>
        {links.map(({ label, href }) => (
          <NavigationMenuItem key={label}>
            <NavigationMenuLink
              render={<Link href={href} />}
              className={navigationMenuTriggerStyle()}
            >
              {label}
            </NavigationMenuLink>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
