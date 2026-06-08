import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { transactions } from "./data";
import type { TransactionStatus } from "./data";

const statusConfig: Record<TransactionStatus, { className: string }> = {
  Completed: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  Pending: {
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  Failed: {
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

export function TransactionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-(--card-spacing) text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => {
              const cfg = statusConfig[tx.status];
              return (
                <TableRow key={tx.id}>
                  <TableCell className="pl-(--card-spacing) text-muted-foreground text-sm whitespace-nowrap">
                    {tx.date}
                  </TableCell>
                  <TableCell className="font-medium">{tx.description}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("border-transparent", cfg.className)}
                    >
                      {tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "pr-(--card-spacing) text-right tabular-nums font-medium",
                      tx.positive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {tx.amount}
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
