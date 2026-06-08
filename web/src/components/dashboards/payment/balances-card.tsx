import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { totalBalance, currencyBalances } from "./data";

export function BalancesCard() {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Total funds in all balances</CardDescription>
        <CardTitle className="text-3xl tabular-nums font-semibold">
          {totalBalance}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Separator className="mb-4" />
        <div className="flex flex-col gap-3">
          {currencyBalances.map((b) => (
            <div key={b.code} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-12 items-center justify-center rounded-md bg-muted text-xs font-semibold tracking-wider text-muted-foreground">
                  {b.code}
                </span>
                <span className="text-sm text-muted-foreground">{b.label}</span>
              </div>
              <span className="text-sm font-medium tabular-nums">{b.amount}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
