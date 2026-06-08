import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { recentOrders, bestSellingProducts } from "./data";

// ─── Recent Orders ────────────────────────────────────────────────────────────

const statusConfig = {
  success: {
    label: "Success",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  processing: {
    label: "Processing",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
} as const;

export function RecentOrdersCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="pr-(--card-spacing)">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentOrders.map((order) => {
              const cfg = statusConfig[order.status];
              return (
                <TableRow key={order.id}>
                  <TableCell className="pl-(--card-spacing) font-mono text-muted-foreground">
                    {order.id}
                  </TableCell>
                  <TableCell className="font-medium">{order.customer}</TableCell>
                  <TableCell className="text-muted-foreground">{order.product}</TableCell>
                  <TableCell className="tabular-nums">{order.amount}</TableCell>
                  <TableCell className="pr-(--card-spacing)">
                    <Badge
                      variant="outline"
                      className={cn("border-transparent", cfg.className)}
                    >
                      {cfg.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Best Selling Products ────────────────────────────────────────────────────

export function BestSellingProductsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Best Selling Products</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Product</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="pr-(--card-spacing) text-right">Sold</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bestSellingProducts.map((product) => (
              <TableRow key={product.name}>
                <TableCell className="pl-(--card-spacing)">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-block size-7 shrink-0 rounded-md",
                        product.color
                      )}
                    />
                    <span className="font-medium">{product.name}</span>
                  </div>
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {product.price}
                </TableCell>
                <TableCell className="pr-(--card-spacing) text-right tabular-nums">
                  {product.sold.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
