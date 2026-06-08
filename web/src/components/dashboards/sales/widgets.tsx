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
import { bestSellingProducts, salesOrders } from "./data";

// ─── Best Selling Product ─────────────────────────────────────────────────────

export function BestSellingProductCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Best Selling Product</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {bestSellingProducts.map((product) => (
            <li
              key={product.name}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-block size-7 shrink-0 rounded-md",
                    product.color
                  )}
                />
                <span className="text-sm font-medium">{product.name}</span>
              </div>
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                {product.sold} sold
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── Track Order Status ───────────────────────────────────────────────────────

type OrderStat = {
  label: string;
  value: number;
  delta: string;
};

const orderStats: OrderStat[] = [
  { label: "New Order",   value: 43, delta: "+0.5%" },
  { label: "On Progress", value: 12, delta: "+0.3%" },
  { label: "Completed",   value: 40, delta: "+0.5%" },
  { label: "Return",      value: 2,  delta: "+0.5%" },
];

export function TrackOrderStatusCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Track Order Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {orderStats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-1 rounded-lg border p-3"
            >
              <span className="text-2xl font-semibold tabular-nums">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {stat.delta}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Order Table ──────────────────────────────────────────────────────────────

const statusConfig = {
  paid: {
    label: "Paid",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  pending: {
    label: "Pending",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
} as const;

export function OrderTableCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">ID</TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead>Qty Items</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead className="pr-(--card-spacing)">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salesOrders.map((order) => {
              const cfg = statusConfig[order.status];
              return (
                <TableRow key={order.id}>
                  <TableCell className="pl-(--card-spacing) font-mono text-muted-foreground">
                    {order.id}
                  </TableCell>
                  <TableCell className="font-medium">{order.customer}</TableCell>
                  <TableCell className="tabular-nums">{order.qtyItems}</TableCell>
                  <TableCell className="tabular-nums">{order.amount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {order.paymentMethod}
                  </TableCell>
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
