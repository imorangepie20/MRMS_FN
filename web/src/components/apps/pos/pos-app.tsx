"use client"

import { useState, useMemo } from "react"
import { Search, Plus, Minus, Trash2, ShoppingCart, X, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { PRODUCTS, CATEGORIES, type Category, type Product } from "./data"

type CartItem = {
  product: Product
  quantity: number
}

const TAX_RATE = 0.08
const DISCOUNT = 0

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

export function POSApp() {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<Category>("All")
  const [cart, setCart] = useState<CartItem[]>([])

  // Filtered products
  const filtered = useMemo(() => {
    return PRODUCTS.filter((p) => {
      const matchesCategory = activeCategory === "All" || p.category === activeCategory
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [search, activeCategory])

  // Cart actions
  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  function increment(productId: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    )
  }

  function decrement(productId: string) {
    setCart((prev) => {
      const updated = prev.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      )
      return updated.filter((item) => item.quantity > 0)
    })
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId))
  }

  function clearCart() {
    setCart([])
  }

  // Totals
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const tax = subtotal * TAX_RATE
  const total = subtotal + tax - DISCOUNT
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="flex h-full min-h-0 gap-4 p-4">
      {/* ── Left: Product area ───────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* Search + category filter */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as Category)}>
            <TabsList className="w-full justify-start overflow-x-auto">
              {CATEGORIES.map((cat) => (
                <TabsTrigger key={cat} value={cat} className="flex-shrink-0">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Product grid */}
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No products found.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={addToCart}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Right: Cart/Order panel ──────────────────── */}
      <div className="flex w-80 flex-col gap-0 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-4 text-muted-foreground" />
            <span className="font-medium text-sm">Current Order</span>
          </div>
          <Badge variant={itemCount > 0 ? "default" : "secondary"}>
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </Badge>
        </div>

        <Separator />

        {/* Cart items */}
        <ScrollArea className="flex-1">
          {cart.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <ShoppingCart className="size-8 opacity-30" />
              <span>Cart is empty</span>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {cart.map((item) => (
                <CartLineItem
                  key={item.product.id}
                  item={item}
                  onIncrement={() => increment(item.product.id)}
                  onDecrement={() => decrement(item.product.id)}
                  onRemove={() => removeItem(item.product.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Summary */}
        <div className="flex flex-col gap-3 px-4 py-3">
          {/* Customer row */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="size-3.5" />
            <span>Walk-in Customer</span>
          </div>

          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{fmt.format(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax (8%)</span>
              <span>{fmt.format(tax)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-green-600 dark:text-green-400">
                {DISCOUNT > 0 ? `-${fmt.format(DISCOUNT)}` : fmt.format(0)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{fmt.format(total)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <Button
            disabled={cart.length === 0}
            className="w-full"
            size="lg"
          >
            {cart.length === 0 ? "Charge" : `Charge ${fmt.format(total)}`}
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={cart.length === 0}
            onClick={clearCart}
            className="w-full"
          >
            <X className="size-3.5" />
            Clear Order
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── ProductCard ──────────────────────────────────────

type ProductCardProps = {
  product: Product
  onAdd: (product: Product) => void
}

function ProductCard({ product, onAdd }: ProductCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 active:scale-[0.98]"
      )}
      onClick={() => onAdd(product)}
    >
      {/* Thumbnail */}
      <div
        className="h-24 w-full"
        style={{
          background: `linear-gradient(135deg, ${product.gradientFrom}, ${product.gradientTo})`,
        }}
      />
      <CardContent className="pt-0">
        <div className="flex flex-col gap-1 py-2">
          <div className="flex items-start justify-between gap-1">
            <span className="text-sm font-medium leading-tight">{product.name}</span>
          </div>
          <Badge variant="secondary" className="w-fit text-xs">
            {product.category}
          </Badge>
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-semibold text-primary">
              {fmt.format(product.price)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAdd(product)
              }}
              className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/80"
              aria-label={`Add ${product.name} to cart`}
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── CartLineItem ─────────────────────────────────────

type CartLineItemProps = {
  item: CartItem
  onIncrement: () => void
  onDecrement: () => void
  onRemove: () => void
}

function CartLineItem({ item, onIncrement, onDecrement, onRemove }: CartLineItemProps) {
  const lineTotal = item.product.price * item.quantity

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Color swatch */}
      <div
        className="size-8 flex-shrink-0 rounded-md"
        style={{
          background: `linear-gradient(135deg, ${item.product.gradientFrom}, ${item.product.gradientTo})`,
        }}
      />

      {/* Name + price */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.product.name}</div>
        <div className="text-xs text-muted-foreground">{fmt.format(item.product.price)}</div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        <button
          onClick={onDecrement}
          className="flex size-5 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Decrease quantity"
        >
          <Minus className="size-3" />
        </button>
        <span className="w-5 text-center text-sm tabular-nums">{item.quantity}</span>
        <button
          onClick={onIncrement}
          className="flex size-5 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Increase quantity"
        >
          <Plus className="size-3" />
        </button>
      </div>

      {/* Line total */}
      <div className="w-14 text-right text-sm font-medium tabular-nums">
        {fmt.format(lineTotal)}
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="flex size-5 items-center justify-center text-muted-foreground transition-colors hover:text-destructive"
        aria-label={`Remove ${item.product.name}`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}
