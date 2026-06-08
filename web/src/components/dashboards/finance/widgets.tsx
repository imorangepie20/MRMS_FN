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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  incomeSources,
  totalIncome,
  financeTransactions,
  walletEntries,
} from "./data";

// ─── Income Sources ───────────────────────────────────────────────────────────

export function IncomeSourcesCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle>Income Sources</CardTitle>
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums">$92,000</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">+15.5%</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {incomeSources.map((src) => {
            const pct = Math.round((src.amount / totalIncome) * 100);
            return (
              <div key={src.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{src.label}</span>
                  <span className="tabular-nums font-medium">{src.formatted}</span>
                </div>
                <Progress value={pct} aria-label={src.label} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Transactions ─────────────────────────────────────────────────────────────

const typeConfig = {
  Income: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  Expenses: {
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
} as const;

export function FinanceTransactionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Transaction</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="pr-(--card-spacing) text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {financeTransactions.map((tx) => {
              const cfg = typeConfig[tx.type];
              return (
                <TableRow key={tx.id}>
                  <TableCell className="pl-(--card-spacing) font-medium">
                    {tx.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {tx.date}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("border-transparent", cfg.className)}
                    >
                      {tx.type}
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

// ─── Saving Goal ──────────────────────────────────────────────────────────────

export function SavingGoalCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saving Goal</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <p className="text-sm text-muted-foreground">$1052.98 of $1,200</p>
          <p className="text-sm font-semibold tabular-nums">75%</p>
        </div>
        <Progress value={75} aria-label="Saving Goal" />
      </CardContent>
    </Card>
  );
}

// ─── My Wallet ────────────────────────────────────────────────────────────────

export function MyWalletCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Wallet</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        {walletEntries.map((entry, index) => (
          <div key={entry.brand}>
            <div className="flex items-center justify-between py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{entry.brand}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {entry.masked}
                </span>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {entry.balance}
              </span>
            </div>
            {index < walletEntries.length - 1 && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
